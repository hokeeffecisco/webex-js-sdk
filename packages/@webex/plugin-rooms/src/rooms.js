/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin, Page} from '@webex/webex-core';
import {cloneDeep} from 'lodash';
import {
  SDK_EVENT,
  createEventEnvelope,
  buildHydraPersonId,
  buildHydraRoomId,
  getHydraClusterString,
  getHydraRoomType,
  deconstructHydraId
} from '@webex/common';

const debug = require('debug')('rooms');

/**
 * @typedef {Object} RoomObject
 * @property {string} id - (server generated) Unique identifier for the room
 * @property {string} title - The display name for the room. All room members
 * will see the title so make it something good
 * @property {string} teamId - (optional) The ID of the team to which the room
 * belongs
 * @property {isoDate} created - (server generated) The date and time that the
 * room was created
 */

/**
 * Rooms are virtual meeting places for getting stuff done. This resource
 * represents the room itself. Check out the {@link Memberships} API to learn
 * how to add and remove people from rooms and the {@link Messages} API for
 * posting and managing content.
 * @class
 * @name Rooms
 */
const Rooms = WebexPlugin.extend({
  /**
   * Register to listen for incoming rooms events
   * This is an alternate approach to registering for rooms webhooks.
   * The events passed to any registered handlers will be similar to the webhook JSON,
   * but will omit webhook specific fields such as name, secret, url, etc.
   * To utilize the `listen()` method, the authorization token used
   * will need to have `spark:all` and `spark:kms` scopes enabled.
   * Note that by configuring your application to enable or disable `spark:all`
   * via its configuration page will also enable or disable `spark:kms`.
   * See the <a href="https://webex.github.io/webex-js-sdk/samples/browser-socket/">Sample App</a>
   * for more details.
   * @instance
   * @memberof Rooms
   * @returns {Promise}
   * @example
   * webex.rooms.listen()
   *   .then(() => {
   *     console.log('listening to room events');
   *     webex.rooms.on('created', (event) => console.log(`Got a room:created event:\n${event}`);
   *     webex.rooms.on('updated', (event) => console.log(`Got a room:updated event:\n${event}`);
   *   })
   *   .catch((e) => console.error(`Unable to register for room events: ${e}`));
   * // Some app logic...
   * // WHen it is time to cleanup
   * webex.rooms.stopListening();
   * webex.rooms.off('created');
   * webex.rooms.off('updated');
   */
  listen() {
    return createEventEnvelope(this.webex, SDK_EVENT.EXTERNAL.RESOURCE.ROOMS)
      .then((envelope) => {
        this.eventEnvelope = envelope;

        return this.webex.internal.mercury.connect().then(() => {
          this.listenTo(this.webex.internal.mercury,
            SDK_EVENT.INTERNAL.WEBEX_ACTIVITY,
            (event) => this.onWebexApiEvent(event));
        });
      });
  },

  /**
   * Creates a new room. The authenticated user is automatically added as a
   * member of the room. See the {@link Memberships} API to learn how to add
   * more people to the room.
   * @instance
   * @memberof Rooms
   * @param {RoomObject} room
   * @returns {Promise<RoomObject>}
   * @example
   * webex.rooms.create({title: 'Create Room Example'})
   *   .then(function(room) {
   *     var assert = require('assert')
   *     assert(typeof room.created === 'string');
   *     assert(typeof room.id === 'string');
   *     assert(room.title === 'Create Room Example');
   *     console.log(room.title);
   *     return 'success';
   *   });
   *   // => success
   */
  create(room) {
    return this.request({
      method: 'POST',
      service: 'hydra',
      resource: 'rooms',
      body: room
    })
      .then((res) => res.body);
  },

  /**
   * Returns a single room.
   * @instance
   * @memberof Rooms
   * @param {RoomObject|string} room
   * @param {Object} options
   * @returns {Promise<RoomObject>}
   * @example
   * var room;
   * webex.rooms.create({title: 'Get Room Example'})
   *   .then(function(r) {
   *     room = r
   *     return webex.rooms.get(room.id)
   *   })
   *   .then(function(r) {
   *     var assert = require('assert');
   *     assert.deepEqual(r, room);
   *     return 'success';
   *   });
   *   // => success
   */
  get(room, options) {
    const id = room.id || room;

    return this.request({
      service: 'hydra',
      resource: `rooms/${id}`,
      qs: options
    })
      .then((res) => res.body.items || res.body);
  },

  /**
   * Returns a list of rooms. In most cases the results will only contain rooms
   * that the authenticated user is a member of.
   * @instance
   * @memberof Rooms
   * @param {Object} options
   * @param {Object} options.max Limit the maximum number of rooms in the
   * response.
   * @returns {Promise<Page<RoomObject>>}
   * @example
   * var createdRooms;
   * Promise.all([
   *   webex.rooms.create({title: 'List Rooms Example 1'}),
   *   webex.rooms.create({title: 'List Rooms Example 2'}),
   *   webex.rooms.create({title: 'List Rooms Example 3'})
   * ])
   *   .then(function(r) {
   *     createdRooms = r;
   *     return webex.rooms.list({max: 3})
   *       .then(function(rooms) {
   *         var assert = require('assert');
   *         assert(rooms.length === 3);
   *         for (var i = 0; i < rooms.items.length; i+= 1) {
   *           assert(createdRooms.filter(function(room) {
   *             return room.id === rooms.items[i].id;
   *           }).length === 1);
   *         }
   *         return 'success';
   *       });
   *   });
   *   // => success
   */
  list(options) {
    return this.request({
      service: 'hydra',
      resource: 'rooms/',
      qs: options
    })
      .then((res) => new Page(res, this.webex));
  },

  /**
   * Returns a list of rooms with details about the data of the last
   * activity in the room, and the date of the users last presences in
   * the room. The list is sorted with this with most recent activity first
   *
   * For rooms where lastActivityDate > lastSeenDate the space
   * can be considered to be "unread"
   *
   * This differs from the rooms.list() function in the following ways:
   *  -- when called with no parameters it returns an array of all
   *     spaces, up to 1000, that the user is a member of
   *  -- pagination is not supported. ALL rooms are returned which
   *     can result in a large payload
   *  -- For users with hundreds of spaces, this API can take some time to
   *     to return, for this reason it supports an optional maxRecent parameter.
   *     If set this will return only the specified number of spaces with activity
   *     in the last two weeks.  Recommended value is 30.  Max supported is 100.
   *  -- only "id", "type", "lastActivityDate", and "lastSeenDate" are
   *     guaranteed to be available for each room in the list
   *  -- "title" is usually returned, but not guaranteed
   *
   * In general this function should be used only when the client needs to
   * access read status info, for example on startup.
   * After startup, clients should track message and membership:seen events
   * to maintain read status client side.
   *
   * Since this API can take some time to return up to 1000 spaces, it is
   * recommended that custom clients call this first with the maxRecent parameter
   * set to 30, so that they can display some of the more recents spaces.  Calling
   * this API a second time with no parameters will return all the spaces.
   *
   * Not all spaces may be returned, for example when users in more than 1000
   * spaces, or when a new spaces is added after this function is called,
   * but before it returns. Custom clients should be prepared to gracefully
   * handle cases where an event occurs in a space not returned by this call,
   * by querying rooms.getWithReadStatus() with the id of the room in question
   *
   * This function may be deprecated when this info is provided in the membership
   * objects returned in the list function.
   * @instance
   * @param {int} maxRecent
   * @memberof Rooms
   * @returns {Promise<RoomInfoObjectList>}
   */
  async listWithReadStatus(maxRecent = 0) {
    const now = new Date();
    const options = {
      activitiesLimit: 0,
      computeTitleIfEmpty: true,
      conversationsLimit: 1000,
      isActive: true
    };

    if (maxRecent > 0) {
      options.conversationsLimit = maxRecent;
      options.sinceDate = now.setDate(now.getDate() - 14);
    }
    else if ((maxRecent < 0) || (maxRecent > 100)) {
      return Promise.reject(new Error('rooms.listWithReadStatus: ' +
        'optional maxRecent parameter must be an integer between 1 and 100'));
    }

    return this.webex.internal.services.waitForCatalog('postauth')
      .then(() => this.webex.internal.conversation.list(options))
      .then((conversations) => buildRoomInfoList(this.webex, conversations));
  },

  /**
   * Returns a single room object with details about the data of the last
   * activity in the room, and the date of the users last presence in
   * the room.
   *
   * For rooms where lastActivityDate > lastSeenDate the room
   * can be considered to be "unread"
   *
   * This differs from the rooms.get() function in the following ways:
   *  -- it takes a single roomId parameter to fetch
   *  -- no other options are considered
   *  -- only "id", "type", "lastActivityDate", and "lastSeenDate" are
   *     guaranteed to be available in the return object
   *  -- "title" is usually returned, but not guaranteed
   *
   * In general clients should use the listWithReadStatus() method on startup
   * to get the initial roomStatus and then update their client side copy by
   * responding to message, membership and room events.

   * This function allows a custom client to be "nimble" if it is responding
   * to an event with a roomId that was not in the original fetch.  The
   * anticipated behavior is that getWithReadStats is called "just in time",
   * with the resulting room object being added to the list of cached room
   * objects on the client side.
   *
   * This function may be deprecated when this info is provided in the room
   * object returned in the get function.
   * @instance
   * @memberof Rooms
   * @param {string} roomId
   * @returns {Promise<RoomInfoObject>}
   */
  getWithReadStatus(roomId) {
    const deconstructedId = deconstructHydraId(roomId);
    const conversation = {
      id: deconstructedId.id,
      cluster: deconstructedId.cluster
    };

    return this.webex.internal.services.waitForCatalog('postauth')
      .then(() => this.webex.internal.conversation.get(conversation,
        {
          computeTitleIfEmpty: true,
          activitiesLimit: 0 // don't send the whole history of activity
        })
        .then((convo) => buildRoomInfo(this.webex, convo)));
  },

  /**
   * Deletes a single room.
   * @instance
   * @memberof Rooms
   * @param {RoomObject|string} room
   * @returns {Promise}
   * @example
   * var room;
   * webex.rooms.create({title: 'Remove Room Example'})
   *  .then(function(r) {
   *    room = r;
   *    return webex.rooms.remove(room.id);
   *  })
   *  .then(function() {
   *    return webex.rooms.get(room.id);
   *  })
   *  .then(function() {
   *    var assert = require('assert');
   *    assert(false, 'the previous get should have failed');
   *  })
   *  .catch(function(reason) {
   *    var assert = require('assert');
   *    assert.equal(reason.statusCode, 404);
   *    return 'success'
   *  });
   *  // => success
   */
  remove(room) {
    const id = room.id || room;

    return this.request({
      method: 'DELETE',
      service: 'hydra',
      resource: `rooms/${id}`
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
   * Used to update a single room's properties.
   * @instance
   * @memberof Rooms
   * @param {RoomObject} room
   * @returns {Promise<RoomObject>}
   * @example
   * var room;
   * webex.rooms.update({title: 'Update Room Example'})
   *   .then(function(r) {
   *     room = r;
   *     room.title = 'Update Room Example (Updated Title)';
   *     return webex.rooms.update(room);
   *   })
   *   .then(function() {
   *     return webex.rooms.get(room.id);
   *   })
   *   .then(function(room) {
   *    var assert = require('assert');
   *     assert.equal(room.title, 'Update Room Example (Updated Title)');
   *     return 'success';
   *   });
   *   // => success
   */
  update(room) {
    const {id} = room;

    return this.request({
      method: 'PUT',
      service: 'hydra',
      resource: `rooms/${id}`,
      body: room
    })
      .then((res) => res.body);
  },

  /**
   * This function is called when an internal membership events fires,
   * if the user registered for these events with the listen() function.
   * External users of the SDK should not call this function
   * @private
   * @memberof Rooms
   * @param {Object} event
   * @returns {void}
   */
  onWebexApiEvent(event) {
    const {activity} = event.data;

    /* eslint-disable no-case-declarations */
    switch (activity.verb) {
      case SDK_EVENT.INTERNAL.ACTIVITY_VERB.CREATE:
        const roomCreatedEvent =
          this.getRoomEvent(this.webex, activity, SDK_EVENT.EXTERNAL.EVENT_TYPE.CREATED);

        if (roomCreatedEvent) {
          debug(`room "created" payload: \
            ${JSON.stringify(roomCreatedEvent)}`);
          this.trigger(SDK_EVENT.EXTERNAL.EVENT_TYPE.CREATED, roomCreatedEvent);
        }
        break;

      case SDK_EVENT.INTERNAL.ACTIVITY_VERB.UPDATE:
      case SDK_EVENT.INTERNAL.ACTIVITY_VERB.LOCK:
      case SDK_EVENT.INTERNAL.ACTIVITY_VERB.UNLOCK:
        debug(`generating a rooms:updated based on ${activity.verb} activity`);
        const roomUpdatedEvent =
          this.getRoomEvent(this.webex, activity, SDK_EVENT.EXTERNAL.EVENT_TYPE.UPDATED);

        if (roomUpdatedEvent) {
          debug(`room "updated" payload: \
            ${JSON.stringify(roomUpdatedEvent)}`);
          this.trigger(SDK_EVENT.EXTERNAL.EVENT_TYPE.UPDATED, roomUpdatedEvent);
        }
        break;

      default:
        break;
    }
  },

  /**
   * Constructs the data object for an event on the rooms resource,
   * adhering to Hydra's Webhook data structure.
   * External users of the SDK should not call this function
   * @private
   * @memberof Rooms
   * @param {Object} webex sdk instance
   * @param {Object} activity from mercury
   * @param {Object} event type of "webhook" event
   * @returns {Object} constructed event
   */
  getRoomEvent(webex, activity, event) {
    try {
      const sdkEvent = cloneDeep(this.eventEnvelope);
      const cluster = getHydraClusterString(webex, activity.url);
      let {tags} = activity.object;

      sdkEvent.event = event;
      sdkEvent.data.created = activity.published;
      sdkEvent.actorId = buildHydraPersonId(activity.actor.entryUUID, cluster);
      if (activity.object.id) {
        sdkEvent.data.id = buildHydraRoomId(activity.object.id, cluster);
      }
      else {
        sdkEvent.data.id = buildHydraRoomId(activity.target.id, cluster);
      }

      if (event === SDK_EVENT.EXTERNAL.EVENT_TYPE.CREATED) {
        sdkEvent.data.creatorId = buildHydraPersonId(activity.actor.entryUUID, cluster);
        sdkEvent.data.lastActivity = activity.published;
      }
      else if (event === SDK_EVENT.EXTERNAL.EVENT_TYPE.UPDATED) {
        if (activity.verb === 'update') {
          // For some reason the tags are not in the object for an update activity
          tags = activity.target.tags;
        }
        if (activity.object.creatorUUID) {
          // This seems to be set in lock/unlock activities but not updated...
          debug(`Found a creatorId: ${activity.object.creatorUUID} in a ${activity.verb} event`);
          sdkEvent.data.creatorId = buildHydraPersonId(activity.object.creatorUUID, cluster);
        }
        // Webhook engine team sets this based on lastReadableActivityDate
        // in the activity.target object.  See: hydra/HydraRoom.java#L51
        // This elements seems to be missing from the activity that the SDK is getting
        // sdkEvent.data.lastActivity = activity.target.lastReadableActivityDate;
      }
      else {
        throw new Error('unexpected event type');
      }
      sdkEvent.data.type = getHydraRoomType(tags);
      sdkEvent.data.isLocked =
        tags.includes(SDK_EVENT.INTERNAL.ACTIVITY_TAG.LOCKED);

      return sdkEvent;
    }
    catch (e) {
      this.webex.logger.error(`Unable to generate SDK event from mercury socket activity for rooms:${event} event: ${e.message}`);

      return null;
    }
  }

});

export default Rooms;

/**
 * Helper method to build a roomInfo object from a conversation object
 * @param {Object} webex sdk object
 * @param {Conversation~ConversationObject} conversation
 * @returns {Promise<RoomInfoObject>}
 */
async function buildRoomInfo(webex, conversation) {
  try {
    const type = getHydraRoomType(conversation.tags);
    const cluster = getHydraClusterString(webex, conversation.url);
    const title = conversation.displayName ?
      conversation.displayName : conversation.computedTitle;
    const lastActivityDate = conversation.lastReadableActivityDate ?
      conversation.lastReadableActivityDate :
      conversation.lastRelevantActivityDate;

    const roomInfo = {
      id: buildHydraRoomId(conversation.id, cluster),
      type,
      ...(title && {title: conversation.displayName}),
      ...(lastActivityDate && {lastActivityDate}),
      lastSeenActivityDate: conversation.lastSeenActivityDate ?
        conversation.lastSeenActivityDate :
        // If user has never been seen set the date to "a long time ago"
        new Date(0).toISOString()
    };

    return Promise.resolve(roomInfo);
  }
  catch (e) {
    return Promise.reject(e);
  }
}

/**
 * Helper method to build a list of roomInfo object from conversation list
 * @param {Object} webex sdk object
 * @param {Conversation~ConversationObjectList} conversations
 * @returns {Promise<RoomInfoList>}
 */
async function buildRoomInfoList(webex, conversations) {
  // Convert each Conversation into a roomInfo object
  const roomReadInfo = {items: []};
  const roomInfoPromises = [];

  for (const conversation of conversations) {
    roomInfoPromises.push(buildRoomInfo(webex, conversation));
  }

  return Promise.all(roomInfoPromises)
    .then((roomInfoList) => {
      roomReadInfo.items = roomInfoList;
      roomReadInfo.items.sort((a, b) => (a.lastActivityDate < b.lastActivityDate ? 1 : -1));

      return roomReadInfo;
    });
}
