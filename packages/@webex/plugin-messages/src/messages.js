/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {
  SDK_EVENT,
  buildHydraMessageId,
  buildHydraPersonId,
  buildHydraRoomId,
  createEventEnvelope,
  getHydraClusterString
} from '@webex/common';
import {
  Page,
  WebexPlugin
} from '@webex/webex-core';
import {cloneDeep, isArray} from 'lodash';

const verbToType = {
  [SDK_EVENT.INTERNAL.ACTIVITY_VERB.SHARE]:
    SDK_EVENT.EXTERNAL.EVENT_TYPE.CREATED,
  [SDK_EVENT.INTERNAL.ACTIVITY_VERB.POST]:
    SDK_EVENT.EXTERNAL.EVENT_TYPE.CREATED,
  [SDK_EVENT.INTERNAL.ACTIVITY_VERB.DELETE]:
    SDK_EVENT.EXTERNAL.EVENT_TYPE.DELETED
};

const getRoomType = (roomTags) =>
  (roomTags.includes(SDK_EVENT.INTERNAL.ACTIVITY_TAG.ONE_ON_ONE) ?
    SDK_EVENT.EXTERNAL.SPACE_TYPE.DIRECT :
    SDK_EVENT.EXTERNAL.SPACE_TYPE.GROUP);

/**
 * @typedef {Object} MessageObject
 * @property {string} id - (server generated) Unique identifier for the message
 * @property {string} personId - The ID for the author of the message
 * @property {email} personEmail - The email for the author of the message
 * @property {string} roomId - The ID for the room of the message
 * @property {string} text - The message posted to the room in plain text
 * @property {string} markdown - The message posted to the room in markdown
 * @property {Array<string>} files - The source URL(s) for the message attachment(s).
 * See the {@link https://developer.webex.com/docs/api/basics#message-attachments|Message Attachments}
 * Guide for a list of supported media types.
 * @property {isoDate} created - (server generated) The date and time that the message was created
 */

/**
 * Messages are how people communicate in rooms. Each message timestamped and
 * represented in Webex as a distinct block of content. Messages can contain
 * plain text and a single file attachment. See the
 * {@link https://developer.webex.com/docs/api/basics#message-attachments|Message Attachments} Guide
 * for a list of supported media types.
 * @class
 */
const Messages = WebexPlugin.extend({
  /**
   * Initializer used to generate Messages
   * as a plugin wrapped around the provided arguments.
   * @private
   * @see WebexPlugin.initialize
   * @param  {...any} args
   * @returns {undefined}
   */
  initialize(...args) {
    Reflect.apply(WebexPlugin.prototype.initialize, this, args);
  },

  /**
   * Register to listen for incoming messages events
   * This is an alternate approach to registering for messages webhooks.
   * The events passed to any registered handlers will be similar to the webhook JSON,
   * but will omit webhook specific fields such as name, secret, url, etc.
   * The messages.listen() event objects can also include additional fields not
   * available in the webhook's JSON payload: `text`, `markdown`, and `files`.
   * These fields are available when their details are included in the web socket's
   * `activity` object. Retrieving other fields, such as the `html` field,
   * will require a manual request to get the corresponding message object.
   * To utilize the `listen()` method, the authorization token used
   * will need to have `spark:all` and `spark:kms` scopes enabled.
   * Note that by configuring your application to enable or disable `spark:all`
   * via its configuration page will also enable or disable `spark:kms`.
   * See the <a href="https://webex.github.io/webex-js-sdk/samples/browser-socket/">Sample App</a>
   * for more details.
   * @instance
   * @memberof Messages
   * @returns {Promise}
   * @example
   * webex.messages.listen()
   *   .then(() => {
   *     console.log('listening to message events');
   *     webex.messages.on('created', (event) => console.log(`Got a message:created event:\n${event}`));
   *     webex.messages.on('deleted', (event) => console.log(`Got a message:deleted event:\n${event}`));
   *   })
   *   .catch((e) => console.error(`Unable to register for message events: ${e}`));
   * // Some app logic...
   * // When it is time to cleanup
   * webex.messages.stopListening();
   * webex.messages.off('created');
   * webex.messages.off('deleted');
   */
  listen() {
    // Create a common envelope that we will wrap all events in
    return createEventEnvelope(this.webex,
      SDK_EVENT.EXTERNAL.RESOURCE.MESSAGES)
      .then((envelope) => {
        this.eventEnvelope = envelope;

        // Register to listen to events
        return this.webex.internal.mercury.connect().then(() => {
          this.listenTo(this.webex.internal.mercury,
            SDK_EVENT.INTERNAL.WEBEX_ACTIVITY,
            (event) => this.onWebexApiEvent(event));
        });
      });
  },

  /**
   * Post a new message and/or media content into a room.
   * @instance
   * @memberof Messages
   * @param {MessageObject} message
   * @returns {Promise<MessageObject>}
   * @example
   * webex.rooms.create({title: 'Create Message Example'})
   *   .then(function(room) {
   *     return webex.messages.create({
   *       text: 'Howdy!',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function(message) {
   *     var assert = require('assert');
   *     assert(message.id);
   *     assert(message.personId);
   *     assert(message.personEmail);
   *     assert(message.roomId);
   *     assert(message.created);
   *     return 'success';
   *   });
   *   // => success
   */
  create(message) {
    let key = 'body';

    if (message.file) {
      this.logger.warn('Supplying a single `file` property is deprecated; please supply a `files` array');
      message.files = [message.file];
      Reflect.deleteProperty(message, 'file');
    }

    if (isArray(message.files) && message.files.reduce((type, file) => type || typeof file !== 'string', false)) {
      key = 'formData';
    }

    const options = {
      method: 'POST',
      service: 'hydra',
      resource: 'messages',
      [key]: message
    };

    return this.request(options)
      .then((res) => res.body);
  },

  /**
   * Returns a single message.
   * @instance
   * @memberof Messages
   * @param {RoomObject|string} message
   * @returns {Promise<MessageObject>}
   * @example
   * var message;
   * webex.rooms.create({title: 'Get Message Example'})
   *   .then(function(room) {
   *     return webex.messages.create({
   *       text: 'Howdy!',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function(m) {
   *     message = m;
   *     return webex.messages.get(message.id);
   *   })
   *   .then(function(message2) {
   *     var assert = require('assert');
   *     assert.deepEqual(message2, message);
   *     return 'success';
   *   });
   *   // => success
   */
  get(message) {
    const id = message.id || message;

    return this.request({
      service: 'hydra',
      resource: `messages/${id}`
    })
      .then((res) => res.body.items || res.body);
  },

  /**
   * Returns a list of messages. In most cases the results will only contain
   * messages posted in rooms that the authenticated user is a member of.
   * @instance
   * @memberof Messages
   * @param {Object} options
   * @param {string} options.roomId
   * @param {number} options.max
   * @returns {Promise<Page<MessageObject>>}
   * @example
   * var message1, message2, room;
   * webex.rooms.create({title: 'List Messages Example'})
   *   .then(function(r) {
   *     room = r;
   *     return webex.messages.create({
   *       text: 'Howdy!',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function(m) {
   *     message1 = m;
   *     return webex.messages.create({
   *       text: 'How are you?',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function(m) {
   *     message2 = m;
   *     return webex.messages.list({roomId: room.id});
   *   })
   *   .then(function(messages) {
   *     var assert = require('assert');
   *     assert.equal(messages.length, 2);
   *     assert.equal(messages.items[0].id, message2.id);
   *     assert.equal(messages.items[1].id, message1.id);
   *     return 'success';
   *   });
   *   // => success
   */
  list(options) {
    return this.request({
      service: 'hydra',
      resource: 'messages',
      qs: options
    })
      .then((res) => new Page(res, this.webex));
  },

  /**
   * Deletes a single message. Deleting a message will notify all members of the
   * room that the authenticated user deleted the message. Generally, users can
   * only delete their own messages except for the case of Moderated Rooms and
   * Org Administrators.
   * @instance
   * @memberof Messages
   * @param {MessageObject|uuid} message
   * @returns {Promise}}
   * @example
   * var message1, room;
   * webex.rooms.create({title: 'Messages Example'})
   *   .then(function(r) {
   *     room = r;
   *     return webex.messages.create({
   *       text: 'Howdy!',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function(m) {
   *     message1 = m;
   *     return webex.messages.create({
   *       text: 'How are you?',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function() {
   *     return webex.messages.remove(message1);
   *   })
   *   .then(function() {
   *     return webex.messages.list({roomId: room.id});
   *   })
   *   .then(function(messages) {
   *     var assert = require('assert');
   *     assert.equal(messages.items.length, 1);
   *     assert(messages.items[0].id !== message1.id);
   *     return 'success';
   *   });
   *   // => success
   */
  remove(message) {
    const id = message.id || message;

    return this.request({
      method: 'DELETE',
      service: 'hydra',
      resource: `messages/${id}`
    })
      .then((res) => {
        // Firefox has some issues with 204s and/or DELETE. This should move to
        // http-core
        if (res.statusCode === 204) {
          return undefined;
        }

        return res.body;
      });
  },

  /**
   * Curry the 'trigger' method
   * @private
   * @memberof Messages
   * @param {string} type the type of event to fire
   * @returns {function} takes event and triggers it
   */
  fire(type) {
    return (event) => this.trigger(type, event);
  },

  /**
   * This function is called when an internal membership events fires,
   * if the user registered for these events with the listen() function.
   * External users of the SDK should not call this function
   * @private
   * @memberof Messages
   * @param {Object} event
   * @param {Object} event.data contains the data of the event
   * @param {Object} event.data.activity the activity that triggered the event
   * @returns {void}
   */
  onWebexApiEvent({data: {activity}}) {
    const type = verbToType[activity.verb];

    if (!type) {
      return;
    }

    this.getMessageEvent(activity, type)
      .then(this.fire(type));
  },

  /**
   * Constructs the data object for an event on the messages resource,
   * adhering to Hydra's Webhook data structure messages.
   * External users of the SDK should not call this function
   * @private
   * @memberof Messages
   * @param {Object} activity from mercury
   * @param {String} type the type of event
   * @returns {Object} constructed event
   */
  getMessageEvent(activity, type) {
    const {
      id,
      actor: {entryUUID: actorId, emailAddress},
      object: {id: objectId},
      target: {id: roomId, url: roomUrl, tags: roomTags}
    } = activity;

    const cluster = getHydraClusterString(this.webex, roomUrl);
    const combinedEvent = cloneDeep(this.eventEnvelope);

    combinedEvent.event = type;
    if (type === SDK_EVENT.EXTERNAL.EVENT_TYPE.DELETED) {
      // Cannot fetch since the message is deleted
      // Convert the Mercury event to a Hydra event
      const personId = buildHydraPersonId(actorId, cluster);

      return Promise.resolve({
        ...combinedEvent,
        actorId: personId,
        data: {
          id: buildHydraMessageId(objectId, cluster),
          personEmail: emailAddress || actorId,
          personId,
          roomId: buildHydraRoomId(roomId, cluster),
          roomType: getRoomType(roomTags)
        }
      });
    }

    return this.get(buildHydraMessageId(id, cluster))
      .then((data) => ({
        ...combinedEvent,
        actorId: data.personId,
        data
      }));
  }
});

export default Messages;
