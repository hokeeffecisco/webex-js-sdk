/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Batcher} from '@webex/webex-core';
import {uniq} from 'lodash';

const AvatarUrlBatcher = Batcher.extend({
  namespace: 'Avatar',

  handleHttpSuccess(res) {
    // eslint-disable-next-line arrow-body-style
    return Promise.all(res.options.body.map((req) => {
      return Promise.all(req.sizes.map((size) => {
        const response = res.body[req.uuid] && res.body[req.uuid][size] || undefined;

        return this.acceptItem({
          response,
          uuid: req.uuid,
          size
        });
      }));
    }));
  },

  handleHttpError(reason) {
    const msg = reason.message || reason.body || reason;

    // avoid multiple => on same line
    // eslint-disable-next-line arrow-body-style
    return Promise.all(reason.options.body.map((item) => {
      return Promise.all(item.sizes.map((size) => this.getDeferredForRequest({
        uuid: item.uuid,
        size
      })
        // I don't see a better way to do this than with an additional nesting
        // eslint-disable-next-line max-nested-callbacks
        .then((defer) => defer.reject(msg instanceof Error ? msg : new Error(msg)))));
    }));
  },

  didItemFail(item) {
    if (item.response) {
      if (item.size !== item.response.size) {
        this.logger.warn(`Avatar: substituted size "${item.response.size}" for "${item.size}"`);
      }

      return Promise.resolve(false);
    }

    return Promise.resolve(true);
  },

  handleItemFailure(item) {
    return this.getDeferredForRequest(item)
      .then((defer) => {
        defer.reject(new Error(item.response || 'Failed to retrieve avatar'));
      });
  },

  handleItemSuccess(item) {
    return this.getDeferredForResponse(item)
      .then((defer) => defer.resolve({
        hasDefaultAvatar: item.response.defaultAvatar,
        uuid: item.uuid,
        size: item.size,
        url: item.response.url
      }));
  },

  fingerprintRequest(item) {
    return Promise.resolve(`${item.uuid}-${item.size}`);
  },

  fingerprintResponse(item) {
    return Promise.resolve(`${item.uuid}-${item.size}`);
  },

  prepareRequest(queue) {
    const map = queue.reduce((m, item) => {
      let o = m.get(item.uuid);

      if (!o) {
        o = [];
        m.set(item.uuid, o);
      }
      o.push(item.size);

      return m;
    }, new Map());

    const payload = [];

    map.forEach((value, key) => {
      payload.push({
        uuid: key,
        sizes: uniq(value)
      });
    });

    return Promise.resolve(payload);
  },

  submitHttpRequest(payload) {
    return this.webex.request({
      method: 'POST',
      api: 'avatar',
      resource: 'profiles/urls',
      body: payload
    });
  }

});

export default AvatarUrlBatcher;
