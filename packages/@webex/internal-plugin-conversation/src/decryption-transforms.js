/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {camelCase, capitalize, curry} from 'lodash';

import toArray from './to-array';

const decryptTextProp = curry((name, ctx, key, object) => ctx.transform('decryptTextProp', name, key, object));

// eslint-disable-next-line import/prefer-default-export
export const transforms = toArray('inbound', {

  /**
   * This function is used recursively to decrypt various properties on conversations, activities, etc
   * @param   {Object} ctx    An object containing a webex instance and a transform
   * @param   {String} key    KMS encryption key url
   * @param   {Object} object Generic object that you want to decrypt some property on based on the type
   * @returns {Promise}       Returns a transform promise
   */
  decryptObject(ctx, key, object) {
    if (!object) {
      object = key; // eslint-disable-line no-param-reassign
      key = undefined; // eslint-disable-line no-param-reassign
    }

    if (!object) {
      return Promise.resolve();
    }

    if (!object.objectType) {
      return Promise.resolve();
    }

    if (!key && object.encryptionKeyUrl) {
      key = object.encryptionKeyUrl; // eslint-disable-line no-param-reassign
    }

    // Transcoded content was not showing up on the activities since the
    // decryptFile was not being called. Calling decryptFile for
    // transcodedContent fixes the issue.
    if (object.objectType === 'transcodedContent') {
      return Promise.all(object.files.items.map((item) => ctx.transform('decryptFile', key, item)));
    }

    return ctx.transform(`decrypt${capitalize(object.objectType)}`, key, object);
  },

  /**
   * Decrypt an individual submit object from a cardAction activity
   *   (object.objectType === 'submit')
   * @param   {Object} ctx      An object containing a webex instance and a transform
   * @param   {String} key      KMS key
   * @param   {Object} object An instance of a Webex submit object
   * these objects are returned when a user clicks on a Action.Submit button in a card
   * @returns {Promise}         Returns a ctx.transform promise
   */
  decryptSubmit(ctx, key, object) {
    if (!object.inputs) {
      return Promise.resolve();
    }
    const {decryptionFailureMessage} = ctx.webex.internal.conversation.config;

    return ctx.transform('decryptPropCardItem', 0, key, [object.inputs])
      .then((inputs) => {
        object.inputs = JSON.parse(inputs[0]); // eslint-disable-line no-param-reassign
      })
      .catch((reason) => {
        ctx.webex.logger.warn(`plugin-conversation: failed to decrypt attachmentAction.inputs: ${reason}`);
        object.inputs = decryptionFailureMessage; // eslint-disable-line no-param-reassign

        return Promise.resolve(decryptionFailureMessage);
      });
  },

  /**
   * Decrypt an individual reaction2Summary activity (object.objectType === 'reaction2Summary')
   * @param   {Object} ctx      An object containing a webex instance and a transform
   * @param   {String} key      KMS key
   * @param   {Object} object An instance of a Webex reaction2Summary object
   * these objects are returned by various conversation APIs and over mercury
   * represents an aggregated summary of all reactions to a specific activity
   * @returns {Promise}         Returns a ctx.transform promise
   */
  decryptReaction2summary(ctx, key, object) {
    if (!object.reactions) {
      return Promise.resolve();
    }

    return Promise.all(object.reactions.map((reaction) => ctx.transform('decryptPropDisplayName', key, reaction)));
  },

  /**
   * Decrypt an individual reaction2SelfSummary activity (object.objectType === 'reaction2SelfSummary')
   * @param   {Object} ctx      An object containing a webex instance and a transform
   * @param   {String} key      KMS key
   * @param   {Object} object An instance of a Webex reaction2SelfSummary object
   * these objects are returned by various conversation APIs and NOT over mercury
   * they are ONLY received by the self user
   * they represent ONLY the self user's reactions and are used for enforcing
   * limit of times they can react to a specific activity
   * @returns {Promise}         Returns a ctx.transform promise
   */
  decryptReaction2selfsummary(ctx, key, object) {
    if (!object.reactions) {
      return Promise.resolve();
    }

    return Promise.all(object.reactions.map((reaction) => ctx.transform('decryptPropDisplayName', key, reaction)));
  },

  /**
   * Decrypt an individual reaction2 activity (object.objectType === 'reaction2')
   * @param   {Object} ctx      An object containing a webex instance and a transform
   * @param   {String} key      KMS key
   * @param   {Object} object An instance of a Webex reaction2 object
   * these objects are returned by various conversation APIs and over mercury
   * ONLY self users receive these objects
   * @returns {Promise}         Returns a ctx.transform promise
   */
  decryptReaction2(ctx, key, object) {
    return ctx.transform('decryptPropDisplayName', key, object);
  },

  /**
 * Decrypt an individual threadObject
 * @param   {Object} ctx      An object containing a webex instance and a transform
 * @param   {Object} threadObject An instance of a Webex threadObject (the objects returned by the /conversation/api/v1/threads api)
 * @returns {Promise}         Returns a ctx.transform promise
 */
  decryptThread(ctx, threadObject) {
    let promises = [];

    if (threadObject.childActivities && Array.isArray(threadObject.childActivities)) {
      promises = threadObject.childActivities.map((child) => ctx.transform('decryptObject', null, child));
    }

    return Promise.all(promises);
  },

  /**
 * Decrypt an individual meeting container activity
 * @param   {Object} ctx      An object containing a webex instance and a transform
 * @param   {object} key      KMS encryption key url
 * @param   {Object} meetingContainerActivity An instance of a Webex meeting container activity
 * @returns {Promise}         Returns a ctx.transform promise
 */
  decryptMeetingcontainer(ctx, key, meetingContainerActivity) {
    const promises = [];

    if (meetingContainerActivity.displayName) {
      const usableKey = meetingContainerActivity.encryptionKeyUrl || key;

      promises.push(ctx.transform('decryptPropDisplayName', usableKey, meetingContainerActivity));
    }

    if (meetingContainerActivity.extensions) {
      const itemsToDecrypt = meetingContainerActivity.extensions.items.filter((item) => item.data.objectType === 'recording');

      itemsToDecrypt.forEach((itemToDecrypt) => {
        promises.push(ctx.transform('decryptPropTopic', itemToDecrypt.encryptionKeyUrl, itemToDecrypt.data));
      });
    }

    return Promise.all(promises);
  },

  /**
   * Decrypts a given conversation and it's activities by building an array of promises that call
   * decryptObject, which may then call other decrypt functions
   *
   * @param   {Object} ctx          An object containing a webex instance and a transform
   * @param   {String} key          KMS encryption key url (or actual key?)
   * @param   {Object} conversation A Webex conversation object
   * @returns {Promise}             Returns the result of Promise.all
   */
  decryptConversation(ctx, key, conversation) {
    const promises = [];

    if (conversation.activities.items) {
      promises.push(Promise.all(conversation.activities.items.map((item) => ctx.transform('decryptObject', null, item))));
    }

    const usableKey = conversation.encryptionKeyUrl || key;
    const {decryptionFailureMessage} = ctx.webex.internal.conversation.config;

    if (usableKey) {
      promises.push(ctx.transform('decryptPropDisplayName', usableKey, conversation)
        .catch((error) => {
          ctx.webex.logger.warn('plugin-conversation: failed to decrypt display name of ', conversation.url, error);
          Promise.resolve(decryptionFailureMessage);
        }));
      promises.push(ctx.transform('decryptPropContent', usableKey, conversation));
    }
    if (conversation.avatarEncryptionKeyUrl) {
      promises.push(ctx.transform('decryptObject', conversation.avatarEncryptionKeyUrl, conversation.avatar));
    }
    // TODO (holsted 04/06/19): This was deprecated in favor of .previousValue below. I wanted to remove this entirely
    // but I wasn't sure if some open source use cases may be reading from cached conversations or not so leaving it for now.
    if (conversation.previous) {
      promises.push(ctx.transform('decryptPropDisplayName', usableKey, conversation.previous));
    }
    if (conversation.previousValue) {
      promises.push(ctx.transform('decryptPropDisplayName', usableKey, conversation.previousValue));
    }

    return Promise.all(promises);
  },

  /**
   * Decrypt an individual activity
   * @param   {Object} ctx      An object containing a webex instance and a transform
   * @param   {String} key      KMS encryption key url (or actual key?)
   * @param   {Object} activity An instance of a Webex activity
   * @returns {Promise}         Returns a ctx.transform promise
   */
  decryptActivity(ctx, key, activity) {
    if (!activity.encryptionKeyUrl && !(activity.object && activity.object.encryptionKeyUrl)) {
      return Promise.resolve(activity);
    }

    const keyUrl = activity.encryptionKeyUrl || activity.object.encryptionKeyUrl || key;

    let promises = [];

    // iterate and recursively decrypt over children objects

    if (activity.children && Array.isArray(activity.children)) {
      promises = activity.children.map((child) => ctx.transform('decryptObject', keyUrl, child.activity));
    }

    promises.push(ctx.transform('decryptObject', keyUrl, activity.object));

    return Promise.all(promises);
  },

  /**
   * Decrypts a microappInstance (recording) model
   * @param   {Object} ctx                     An object containing a webex instance and transform prop
   * @param   {String} key                     KMS key
   * @param   {Object} microappInstance        A microappInstance which includes several properties of a recording
   * @param   {String} microappInstance.model  An encrypted string which decrypts to an object
   * @returns {Promise}                        Returns a context transform
   */
  decryptMicroappinstance(ctx, key, microappInstance) {
    return ctx.transform('decryptPropModel', key, microappInstance);
  },

  /**
* Decrypts a comment...
* @param {Object} ctx An object containing a webex instance and transform prop
* @param {String} key KMS key
* @param {Object} comment A comment object with a displayName and content (encrypted)
* @returns {Promise} Returns the results of Promise.all on two transforms
*/
  decryptComment(ctx, key, comment) {
    const promises = [
      ctx.transform('decryptPropDisplayName', key, comment),
      ctx.transform('decryptPropContent', key, comment)
    ];

    if (comment.cards && Array.isArray(comment.cards)) {
      comment.cards.map((item, index) => promises.push(ctx.transform('decryptPropCardItem', index, key, comment.cards)));
    }

    return Promise.all(promises);
  },

  /**
   * Decrypts a content field
   * @param   {Object} ctx            An object containing a webex instance and transform prop
   * @param   {String} key            KMS key
   * @param   {Object} content        An object with properties to be decrypted
   * @returns {Promise}               A promise that will return when the decryption has finished
   */
  decryptContent(ctx, key, content) {
    if (content.contentCategory === 'links') {
      return ctx.transform('decryptContentLinks', key, content);
    }

    return ctx.transform('decryptContentFiles', key, content);
  },

  /**
   * Decrypts a content field which contains files and possibly links
   * @param   {Object} ctx            An object containing a webex instance and transform prop
   * @param   {String} key            KMS key
   * @param   {Object} content        An object with properties to be decrypted
   * @param   {Array}  content.files  An array of files to decrypt by calling decryptObject
   * @param   {Array}  content.links  An array of links to decrypt by calling decryptObject
   * @returns {Promise}               A promise that will return when the decryption has finished
   */
  decryptContentFiles(ctx, key, content) {
    if (!content.files || !content.files.items || !Array.isArray(content.files.items)) {
      return Promise.resolve();
    }

    const promises = content.files.items.map((item) => ctx.transform('decryptObject', key, item));

    promises.push(ctx.transform('decryptComment', key, content));

    if (content.links && content.links.items && Array.isArray(content.links.items)) {
      content.links.items.forEach((item) => promises.push(ctx.transform('decryptObject', key, item)));
    }

    return Promise.all(promises);
  },

  /**
   * Decrypts a content field which contains links
   * @param   {Object} ctx            An object containing a webex instance and transform prop
   * @param   {String} key            KMS key
   * @param   {Object} content        An object with properties to be decrypted
   * @param   {Array}  content.links  An array of links to decrypt by calling decryptObject
   * @returns {Promise}               A promise that will return when the decryption has finished
   */
  decryptContentLinks(ctx, key, content) {
    if (!content.links || !content.links.items || !Array.isArray(content.links.items)) {
      return Promise.resolve();
    }

    const promises = content.links.items.map((item) => ctx.transform('decryptObject', key, item));

    promises.push(ctx.transform('decryptComment', key, content));

    return Promise.all(promises);
  },

  /**
   * Decrypts what may be a meeting event?
   * @param   {Object} ctx   An object containing a webex instance and transform prop
   * @param   {String} key   KMS key
   * @param   {Object} event An object with a display name and location to be decrypted
   * @returns {Promise}      Returns the result of Promise.all
   */
  decryptEvent(ctx, key, event) {
    const promises = [
      ctx.transform('decryptPropDisplayName', key, event)
    ];

    if (event.location && event.location.split('.').length === 5) {
      promises.push(ctx.transform('decryptPropLocation', key, event));
    }

    return Promise.all(promises);
  },

  /**
   * Decrypts a file and it's transcodedContents if they exist
   * @param   {Object} ctx  An object containing a webex instance and transform prop
   * @param   {String} key  KMS key
   * @param   {Object} file A file object with file props an optional transcodedCollection to decrypt
   * @returns {Promise}     Returns the result of Promise.all
   */
  decryptFile(ctx, key, file) {
    // using object encryption keyUrl for images instead of activity encryptionKeyUrl
    if (file.encryptionKeyUrl && file.encryptionKeyUrl !== key) {
      key = file.encryptionKeyUrl;
    }

    return Promise.all([
      file.transcodedCollection && Promise.all(file.transcodedCollection.items.map((item) => ctx.transform('decryptObject', key, item))),
      ctx.transform('decryptPropScr', key, file),
      ctx.transform('decryptPropDisplayName', key, file),
      ctx.transform('decryptPropContent', key, file),
      file.image && ctx.transform('decryptPropScr', key, file.image)
    ]);
  },

  /**
   * Decrypts a file and it's transcodedContents if they exist
   * @param   {Object} ctx  An object containing a webex instance and transform prop
   * @param   {String} key  KMS key
   * @param   {Object} link A link object with a URL to decrypt
   * @returns {Promise}     Returns the result of Promise.all
   */
  decryptLink(ctx, key, link) {
    return Promise.all([
      ctx.transform('decryptPropSslr', key, link),
      ctx.transform('decryptPropDisplayName', key, link)
    ]);
  },

  /**
   * Decrypts transcoded file content. Calls decryptFile
   * @param   {Object} ctx               An object containing a webex instance and transform prop
   * @param   {String} key               KMS key
   * @param   {Object} transcodedContent Transcoded content with a files prop
   * @returns {Promise}                  Returns the result of Promise.all
   */
  decryptTranscodedContent(ctx, key, transcodedContent) {
    return Promise.all(transcodedContent.files.items.map((item) => ctx.transform('decryptFile', key, item)));
  },

  /**
   * Decrypts an image uri
   * @param   {Object} ctx       An object containing a webex instance and transform prop
   * @param   {String} key       KMS key
   * @param   {String} imageURI  URI of the image to decrypt
   * @returns {Promise}          Returns a promise.
   */
  decryptImageURI(ctx, key, imageURI) {
    return ctx.transform('decryptPropLocation', key, imageURI);
  },

  /**
   * The heart of most decryption logic ends here. Decrypting text.
   * @param   {Object} ctx    An object containing a webex instance and transform prop
   * @param   {String} name   Property of an object to be decrypted
   * @param   {String} key    KMS key
   * @param   {Object} object A generic object with text props to be decrypted
   * @returns {Promise}       Returns a lonely Promise
   */
  decryptTextProp(ctx, name, key, object) {
    if (!object[name]) {
      return Promise.resolve();
    }
    const {decryptionFailureMessage} = ctx.webex.internal.conversation.config;

    return ctx.webex.internal.encryption.decryptText(key, object[name])
      .then((plaintext) => {
        if (ctx.webex.config.conversation.keepEncryptedProperties) {
          const encryptedPropName = camelCase(`encrypted_${name}`);

          object[encryptedPropName] = object[name]; // eslint-disable-line no-param-reassign
        }

        object[name] = plaintext; // eslint-disable-line no-param-reassign
      })
      .catch((reason) => {
        ctx.webex.logger.warn(`plugin-conversation: failed to decrypt ${name} `, reason);
        object[name] = decryptionFailureMessage; // eslint-disable-line no-param-reassign

        return Promise.resolve(decryptionFailureMessage);
      });
  },

  /**
* Decrypting an element in an Array.
* @param {Object} ctx An object containing a webex instance and transform prop
* @param {Integer} index Property of an object to be decrypted
* @param {String} key KMS key
* @param {Array} array An array of Strings to be decrypted
* @returns {Promise} Returns a lonely Promise
*/
  decryptPropCardItem(ctx, index, key, array) {
    if (!Number.isInteger(index) || !array || !Array.isArray(array) || index < 0 || index >= array.length || !(array[index] instanceof String || typeof array[index] === 'string')) {
      return Promise.resolve();
    }
    const {decryptionFailureMessage} = ctx.webex.internal.conversation.config;

    return ctx.webex.internal.encryption.decryptText(key, array[index])
      .then((plaintext) => {
        array[index] = plaintext; // eslint-disable-line no-param-reassign
      })
      .catch((reason) => {
        ctx.webex.logger.warn(`plugin-conversation: failed to decrypt card at ${index} `, reason);
        array[index] = decryptionFailureMessage; // eslint-disable-line no-param-reassign

        return Promise.resolve(decryptionFailureMessage);
      });
  },
  /**
   * Decrypts the src of an object (for images?)
   * @param   {Object} ctx    An object containing a webex instance and transform prop
   * @param   {String} key    KMS key
   * @param   {Object} object An object with a scr property to be decrypted
   * @returns {Promise}       Returns a promise
   */
  decryptPropScr(ctx, key, object) {
    return ctx.webex.internal.encryption.decryptScr(key, object.scr)
      .then((scr) => {
        object.scr = scr; // eslint-disable-line no-param-reassign
      });
  },

  /**
   * Decrypts the sslr object
   * @param   {Object} ctx    An object containing a webex instance and transform prop
   * @param   {String} key    KMS key
   * @param   {Object} object An object with a sslr property to be decrypted
   * @returns {Promise}       Returns a promise
   */
  decryptPropSslr(ctx, key, object) {
    return ctx.webex.internal.encryption.decryptScr(key, object.sslr)
      .then((sslr) => {
        object.sslr = sslr; // eslint-disable-line no-param-reassign
      });
  },

  decryptPropDisplayName: decryptTextProp('displayName'),

  decryptPropContent: decryptTextProp('content'),

  decryptPropModel: decryptTextProp('model'),

  decryptPropLocation: decryptTextProp('location'),

  decryptPropTopic: decryptTextProp('topic')
});
