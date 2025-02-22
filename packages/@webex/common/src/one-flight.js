/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {wrap} from 'lodash';

import make from './template-container';

// Alias Map and WeakMap to get around a babel compiler bug
const W = WeakMap;
const M = Map;
const WeakMappedMappedMap = make(W, M, M);

const flights = new WeakMappedMappedMap();

/**
 * @memberof Util
 * @param {Object} options
 * @param {Function} options.keyFactory
 * @param {boolean} options.cacheFailures
 * @param {boolean} options.cacheSuccesses
 * @returns {Function}
 */
export default function oneFlight(...params) {
  if (params.length === 3) {
    return Reflect.apply(oneFlightDecorator, null, params);
  }

  const options = params[0] || {};

  const {
    cacheFailures,
    cacheSuccesses,
    keyFactory
  } = options;

  return oneFlightDecorator;

  /**
   * @param {Object} target
   * @param {string} prop
   * @param {Object} descriptor
   * @private
   * @returns {Object}
   */
  function oneFlightDecorator(target, prop, descriptor) {
    const key = prop;

    descriptor.value = wrap(descriptor.value, function oneFlightExecutor(fn, ...args) {
      let innerKey = key;

      if (keyFactory) {
        innerKey = `${innerKey}_${keyFactory(...args)}`;
      }

      /* eslint no-invalid-this: [0] */
      let flight = flights.get(this, target, innerKey);

      if (flight) {
        return flight;
      }

      flight = Reflect.apply(fn, this, args);
      if (!cacheFailures && flight && flight.catch) {
        flight = flight.catch((reason) => {
          flights.delete(this, target, innerKey);

          return Promise.reject(reason);
        });
      }

      if (!cacheSuccesses && flight && flight.then) {
        flight = flight.then((result) => {
          flights.delete(this, target, innerKey);

          return result;
        });
      }

      flights.set(this, target, innerKey, flight);

      return flight;
    });

    // This *should* make decorators compatible with AmpersandState class
    // definitions
    if (typeof target === 'object' && !target.prototype) {
      target[prop] = descriptor.value;
    }

    return descriptor;
  }
}
