/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */

import querystring from 'querystring';

import {WebexPlugin, Page} from '@webex/webex-core';
import promiseSeries from 'es6-promise-series';
import {assign, defaults, chunk, pick} from 'lodash';

import Realtime from './realtime';

const Board = WebexPlugin.extend({
  namespace: 'Board',

  children: {
    realtime: Realtime
  },

  /**
   * Adds Content to a Channel
   * If contents length is greater than config.board.numberContentsPerPageForAdd, this method
   * will break contents into chunks and make multiple GET request to the
   * board service
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @param  {Array} contents - Array of {@link Board~Content} objects
   * @returns {Promise<Board~Content>}
   */
  addContent(channel, contents) {
    let chunks = [];

    chunks = chunk(contents, this.config.numberContentsPerPageForAdd);

    // we want the first promise to resolve before continuing with the next
    // chunk or else we'll have race conditions among patches
    return promiseSeries(chunks.map((part) => this._addContentChunk.bind(this, channel, part)));
  },

  /**
   * Adds Image to a Channel
   * Uploads image to webex files and adds SCR + downloadUrl to the persistence
   * service
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @param  {File} image - image to be uploaded
   * @param  {Object} metadata - metadata such as displayName
   * @returns {Promise<Board~Content>}
   */
  addImage(channel, image, metadata) {
    return this.webex.internal.board._uploadImage(channel, image)
      .then((scr) => this.webex.internal.board.addContent(channel, [{
        type: 'FILE',
        metadata,
        file: {
          mimeType: image.type,
          scr,
          size: image.size,
          url: scr.loc
        }
      }]));
  },

  /**
   * Set a snapshot image for a board
   *
   * @param {Board~Channel} channel
   * @param {File} image
   * @returns {Promise<Board~Channel>}
   */
  setSnapshotImage(channel, image) {
    let imageScr;

    return this.webex.internal.board._uploadImage(channel, image, {hiddenSpace: true})
      .then((scr) => {
        imageScr = scr;

        return this.webex.internal.encryption.encryptScr(channel.defaultEncryptionKeyUrl, imageScr);
      })
      .then((encryptedScr) => {
        imageScr.encryptedScr = encryptedScr;

        return encryptedScr;
      })
      .then(() => {
        const imageBody = {
          image: {
            url: imageScr.loc,
            height: image.height || 900,
            width: image.width || 1600,
            mimeType: image.type || 'image/png',
            scr: imageScr.encryptedScr,
            encryptionKeyUrl: channel.defaultEncryptionKeyUrl,
            fileSize: image.size
          }
        };

        return this.webex.request({
          method: 'PATCH',
          uri: channel.channelUrl,
          body: imageBody
        });
      })
      .then((res) => res.body);
  },

  /**
   * Creates a Channel
   * @memberof Board.BoardService
   * @param  {Conversation~ConversationObject} conversation
   * @param  {Board~Channel} channel
   * @returns {Promise<Board~Channel>}
   */
  createChannel(conversation, channel) {
    return this.webex.request({
      method: 'POST',
      api: 'board',
      resource: '/channels',
      body: this._prepareChannel(conversation, channel)
    })
      .then((res) => res.body);
  },

  _prepareChannel(conversation, channel) {
    return Object.assign({
      aclUrlLink: conversation.aclUrl,
      kmsMessage: {
        method: 'create',
        uri: '/resources',
        userIds: [conversation.kmsResourceObjectUrl],
        keyUris: []
      }
    }, channel);
  },

  /**
   * Deletes a Channel from a Conversation
   * @memberof Board.BoardService
   * @param  {Conversation~ConversationObject} conversation
   * @param  {Board~Channel} channel
   * @param  {Object} options
   * @param  {Object} options.preventDeleteActiveChannel Returns error if channel is in use
   * @returns {Promise}
   */
  deleteChannel(conversation, channel, options = {}) {
    // remove the ACL link between conversation and board
    // remove conversation auth from board KRO in kms message
    const body = {
      aclLinkType: 'INCOMING',
      linkedAcl: conversation.aclUrl,
      kmsMessage: {
        method: 'delete',
        uri: `${channel.kmsResourceUrl}/authorizations?${querystring.stringify({authId: conversation.kmsResourceObjectUrl})}`
      },
      aclLinkOperation: 'DELETE'
    };

    let promise = Promise.resolve();

    if (options.preventDeleteActiveChannel) {
      promise = this.lockChannelForDeletion(channel);
    }

    return promise
      .then(() => this.webex.request({
        method: 'PUT',
        uri: `${channel.aclUrl}/links`,
        body
      }))
      .then((res) => res.body);
  },

  /**
   * Locks and marks a channel for deletion
   * If a channel is being used, it will return 409 - Conflict
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @returns {Promise}
   */
  lockChannelForDeletion(channel) {
    return this.webex.request({
      method: 'POST',
      uri: `${channel.channelUrl}/lock`,
      qs: {
        intent: 'delete'
      }
    })
      .then((res) => res.body);
  },

  /**
   * Keeps a channel as 'active' to prevent other people from deleting it
   * @param  {Board~Channel} channel
   * @returns {Promise}
   */
  keepActive(channel) {
    return this.webex.request({
      method: 'POST',
      uri: `${channel.channelUrl}/keepAlive`
    });
  },

  /**
   * Decrypts a collection of content objects
   *
   * @memberof Board.BoardService
   * @param  {Array} contents curves, text, and images
   * @returns {Promise<Array>} Resolves with an array of {@link Board~Content} objects.
   */
  decryptContents(contents) {
    return Promise.all(contents.items.map((content) => {
      let decryptPromise;

      if (content.type === 'FILE') {
        decryptPromise = this.decryptSingleFileContent(content.encryptionKeyUrl, content);
      }
      else {
        decryptPromise = this.decryptSingleContent(content.encryptionKeyUrl, content.payload);
      }

      return decryptPromise
        .then((res) => {
          Reflect.deleteProperty(content, 'payload');
          Reflect.deleteProperty(content, 'encryptionKeyUrl');

          return defaults(res, content);
        });
    }));
  },

  /**
   * Decryts a single STRING content object
   * @memberof Board.BoardService
   * @param  {string} encryptionKeyUrl
   * @param  {string} encryptedData
   * @returns {Promise<Board~Content>}
   */
  decryptSingleContent(encryptionKeyUrl, encryptedData) {
    return this.webex.internal.encryption.decryptText(encryptionKeyUrl, encryptedData)
      .then((res) => JSON.parse(res));
  },

  /**
   * Decryts a single FILE content object
   * @memberof Board.BoardService
   * @param  {string} encryptionKeyUrl
   * @param  {object} encryptedContent {file, payload}
   * @returns {Promise<Board~Content>}
   */
  decryptSingleFileContent(encryptionKeyUrl, encryptedContent) {
    let metadata;

    if (encryptedContent.payload) {
      metadata = encryptedContent.payload;
    }

    return this.webex.internal.encryption.decryptScr(encryptionKeyUrl, encryptedContent.file.scr)
      .then((scr) => {
        encryptedContent.file.scr = scr;
        if (metadata) {
          return this.webex.internal.encryption.decryptText(encryptionKeyUrl, metadata);
        }

        return '';
      })
      .then((decryptedMetadata) => {
        try {
          encryptedContent.metadata = JSON.parse(decryptedMetadata);
          if (encryptedContent.metadata.displayName) {
            encryptedContent.displayName = encryptedContent.metadata.displayName;
          }
        }
        catch (error) {
          encryptedContent.metadata = {};
        }

        return encryptedContent;
      });
  },

  /**
   * Deletes all Content from a Channel
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @returns {Promise} Resolves with an content response
   */
  deleteAllContent(channel) {
    return this.webex.request({
      method: 'DELETE',
      uri: `${channel.channelUrl}/contents`
    })
      .then((res) => res.body);
  },

  /**
   * Deletes Contents from a Channel except the ones listed in contentsToKeep
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @param  {Array<Board~Content>} contentsToKeep Array of board objects (curves, text, and images) with valid contentId (received from server)
   * @returns {Promise} Resolves with an content response
   */
  deletePartialContent(channel, contentsToKeep) {
    const body = contentsToKeep.map((content) => pick(content, 'contentId'));

    return this.webex.request({
      method: 'POST',
      uri: `${channel.channelUrl}/contents`,
      body,
      qs: {
        clearBoard: true
      }
    })
      .then((res) => res.body);
  },

  /**
   * Encrypts a collection of content
   * @memberof Board.BoardService
   * @param  {string} encryptionKeyUrl channel.defaultEncryptionKeyUrl
   * @param  {Array} contents   Array of {@link Board~Content} objects. (curves, text, and images)
   * @returns {Promise<Array>} Resolves with an array of encrypted {@link Board~Content} objects.
   */
  encryptContents(encryptionKeyUrl, contents) {
    return Promise.all(contents.map((content) => {
      let encryptionPromise;
      let contentType = 'STRING';

      // the existence of an scr will determine if the content is a FILE.
      if (content.file) {
        contentType = 'FILE';
        encryptionPromise = this.encryptSingleFileContent(encryptionKeyUrl, content);
      }
      else {
        encryptionPromise = this.encryptSingleContent(encryptionKeyUrl, content);
      }

      return encryptionPromise
        .then((res) => assign({
          device: this.webex.internal.device.deviceType,
          type: contentType,
          encryptionKeyUrl
        },
        pick(res, 'file', 'payload')));
    }));
  },

  /**
   * Encrypts a single STRING content object
   * @memberof Board.BoardService
   * @param  {string} encryptionKeyUrl
   * @param  {Board~Content} content
   * @returns {Promise<Board~Content>}
   */
  encryptSingleContent(encryptionKeyUrl, content) {
    return this.webex.internal.encryption.encryptText(encryptionKeyUrl, JSON.stringify(content))
      .then((res) => ({
        payload: res,
        encryptionKeyUrl
      }));
  },

  /**
   * Encrypts a single FILE content object
   * @memberof Board.BoardService
   * @param  {string} encryptionKeyUrl
   * @param  {Board~Content} content
   * @returns {Promise<Board~Content>}
   */
  encryptSingleFileContent(encryptionKeyUrl, content) {
    return this.webex.internal.encryption.encryptScr(encryptionKeyUrl, content.file.scr)
      .then((encryptedScr) => {
        content.file.scr = encryptedScr;
        if (content.displayName) {
          content.metadata = assign(content.metadata, {displayName: content.displayName});
        }
        if (content.metadata) {
          return this.webex.internal.encryption.encryptText(encryptionKeyUrl, JSON.stringify(content.metadata))
            .then((encryptedMetadata) => {
              content.metadata = encryptedMetadata;
            });
        }

        return content;
      })
      .then(() => ({
        file: content.file,
        payload: content.metadata,
        encryptionKeyUrl
      }));
  },

  /**
   * Retrieves contents from a specified channel
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @param  {Object} options
   * @param  {Object} options.qs
   * @returns {Promise<Page<Board~Channel>>} Resolves with an array of Content items
   */
  getContents(channel, options) {
    options = options || {};

    const params = {
      uri: `${channel.channelUrl}/contents`,
      qs: {
        contentsLimit: this.config.numberContentsPerPageForGet
      }
    };

    assign(params.qs, pick(options, 'contentsLimit'));

    return this.request(params)
      .then((res) => new Page(res, this.webex));
  },

  /**
   * Gets a Channel
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @returns {Promise<Board~Channel>}
   */
  getChannel(channel) {
    return this.webex.request({
      method: 'GET',
      uri: channel.channelUrl
    })
      .then((res) => res.body);
  },

  /**
   * Gets Channels
   * @memberof Board.BoardService
   * @param {Conversation~ConversationObject} conversation
   * @param {Object} options
   * @param {number} options.channelsLimit number of boards to return per page
   * @param {number} options.type type of whiteboard: whiteboard or annotated
   * @returns {Promise<Page<Board~Channel>>} Resolves with an array of Channel items
   */
  getChannels(conversation, options) {
    options = options || {};

    if (!conversation) {
      return Promise.reject(new Error('`conversation` is required'));
    }

    const params = {
      api: 'board',
      resource: '/channels',
      qs: {
        aclUrlLink: conversation.aclUrl
      }
    };

    assign(params.qs, pick(options, 'channelsLimit', 'type'));

    return this.request(params)
      .then((res) => new Page(res, this.webex));
  },

  /**
   * Pings persistence
   * @memberof Board.BoardService
   * @returns {Promise<Object>} ping response body
   */
  ping() {
    return this.webex.request({
      method: 'GET',
      api: 'board',
      resource: '/ping'
    })
      .then((res) => res.body);
  },

  processActivityEvent(message) {
    let decryptionPromise;

    if (message.contentType === 'FILE') {
      decryptionPromise = this.decryptSingleFileContent(message.envelope.encryptionKeyUrl, message.payload);
    }
    else {
      decryptionPromise = this.decryptSingleContent(message.envelope.encryptionKeyUrl, message.payload);
    }

    return decryptionPromise
      .then((decryptedData) => {
        // call the event handlers
        message.payload = decryptedData;

        return message;
      });
  },

  /**
   * Registers with Mercury
   * @memberof Board.BoardService
   * @param  {Object} data - Mercury bindings
   * @returns {Promise<Board~Registration>}
   */
  register(data) {
    return this.webex.request({
      method: 'POST',
      api: 'board',
      resource: '/registrations',
      body: data
    })
      .then((res) => res.body);
  },

  /**
   * Registers with Mercury for sharing web socket
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @returns {Promise<Board~Registration>}
   */
  registerToShareMercury(channel) {
    return this.webex.internal.feature.getFeature('developer', 'web-shared-mercury')
      .then((isSharingMercuryFeatureEnabled) => {
        if (!this.webex.internal.mercury.localClusterServiceUrls) {
          return Promise.reject(new Error('`localClusterServiceUrls` is not defined, make sure mercury is connected'));
        }
        if (!isSharingMercuryFeatureEnabled) {
          return Promise.reject(new Error('`web-shared-mercury` is not enabled'));
        }

        const {webSocketUrl} = this.webex.internal.device;
        const {mercuryConnectionServiceClusterUrl} = this.webex.internal.mercury.localClusterServiceUrls;

        const data = {
          mercuryConnectionServiceClusterUrl,
          webSocketUrl,
          action: 'ADD'
        };

        return this.webex.request({
          method: 'POST',
          uri: `${channel.channelUrl}/register`,
          body: data
        });
      })
      .then((res) => res.body);
  },

  /**
   * Remove board binding from existing mercury connection
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @param  {String} binding - the binding as provided in board registration
   * @returns {Promise<Board~Registration>}
   */
  unregisterFromSharedMercury(channel, binding) {
    const {webSocketUrl} = this.webex.internal.device;
    const data = {
      binding,
      webSocketUrl,
      action: 'REMOVE'
    };

    return this.webex.request({
      method: 'POST',
      uri: `${channel.channelUrl}/register`,
      body: data
    })
      .then((res) => res.body);
  },

  _addContentChunk(channel, contentChunk) {
    return this.webex.internal.board.encryptContents(channel.defaultEncryptionKeyUrl, contentChunk)
      .then((res) => this.webex.request({
        method: 'POST',
        uri: `${channel.channelUrl}/contents`,
        body: res
      }))
      .then((res) => res.body);
  },

  /**
   * Encrypts and uploads image to WebexFiles
   * @memberof Board.BoardService
   * @param  {Board~Channel} channel
   * @param  {File} file - File to be uploaded
   * @param  {Object} options
   * @param  {Object} options.hiddenSpace - true for hidden, false for open space
   * @private
   * @returns {Object} Encrypted Scr and KeyUrl
   */
  _uploadImage(channel, file, options) {
    options = options || {};

    return this.webex.internal.encryption.encryptBinary(file)
      .then(({scr, cdata}) => Promise.all([scr, this._uploadImageToWebexFiles(channel, cdata, options.hiddenSpace)]))
      .then(([scr, res]) => assign(scr, {loc: res.downloadUrl}));
  },

  _getSpaceUrl(channel, hiddenSpace) {
    let requestUri = `${channel.channelUrl}/spaces/open`;

    if (hiddenSpace) {
      requestUri = `${channel.channelUrl}/spaces/hidden`;
    }

    return this.webex.request({
      method: 'PUT',
      uri: requestUri
    })
      .then((res) => res.body.spaceUrl);
  },

  _uploadImageToWebexFiles(channel, file, hiddenSpace) {
    const fileSize = file.length || file.size || file.byteLength;

    return this._getSpaceUrl(channel, hiddenSpace)
      .then((spaceUrl) => this.webex.upload({
        uri: `${spaceUrl}/upload_sessions`,
        file,
        qs: {
          transcode: true
        },
        phases: {
          initialize: {fileSize},
          upload: {
            $url(session) {
              return session.uploadUrl;
            }
          },
          finalize: {
            $uri(session) {
              return session.finishUploadUrl;
            },
            body: {fileSize}
          }
        }
      }));
  },

  /** Authorize transcoder (for sharing whiteboard to mobile)
   *
   * @param  {Board~Channel} board
   * @memberof Board.BoardService
   * @returns {String} authorization
   */
  authorizeMediaInjector(board) {
    if (!board) {
      Promise.reject(new Error('#authorizeMediaInjector --> cannot authorize transcoder without board'));
    }

    return this.webex.internal.encryption.kms.prepareRequest({
      method: 'create',
      uri: '/authorizations',
      resourceUri: board.kmsResourceUrl,
      anonymous: 1
    })
      .then((request) => this.webex.request({
        uri: `${board.channelUrl}/sharePolicies/transcoder`,
        method: 'PUT',
        body: {kmsMessage: request.wrapped}
      }))
      .then((res) =>
        this.webex.internal.encryption.kms.decryptKmsMessage(res.body.kmsResponse))
      .then((decryptedKmsMessage) => {
        if (decryptedKmsMessage?.authorizations.length > 0) {
          return decryptedKmsMessage.authorizations[0].bearer;
        }

        return undefined;
      })
      .catch((err) =>
      /* We want to resolve any errors so that whiteboard share will still work
       * except mobile being able to receive the share
       */
        Promise.resolve(err));
  },

  /** Unauthorize transcoder (for stopping whiteboard share to mobile)
   *
   * @param  {Board~Channel} board
   * @memberof Board.BoardService
   * @returns {Array} list of authIds removed
   */
  unauthorizeMediaInjector(board) {
    if (!board) {
      Promise.reject(new Error('#unauthorizeMediaInjector --> cannot unauthorize transcoder without board'));
    }

    return this.webex.internal.encryption.kms.listAuthorizations({
      kroUri: board.kmsResourceUrl
    }).then((authorizations) => {
      /* Attempt to remove the authorization made from starting whiteboard share
       * Also removing any previous authorizations that were not cleared
       */
      const promises = authorizations.map((auth) => {
        const {authId} = auth;

        return this.webex.internal.encryption.kms.removeAuthorization({
          authId,
          kroUri: board.kmsResourceUrl
        })
          .then(() => Promise.resolve(authId))
          .catch((err) =>
          /* We don't want this to error out, otherwise the
          * Promise.all will not process the rest of the request
          */
            Promise.resolve(err));
      });

      if (promises.length > 0) {
        return Promise.all(promises).then((responses) => responses);
      }

      return Promise.resolve([]);
    });
  }
});

export default Board;
