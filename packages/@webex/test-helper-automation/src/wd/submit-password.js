/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable no-invalid-this */
/* eslint-disable max-nested-callbacks */

const wd = require('wd');

/**
 * Returns a promise that resolves after 'timeout' milliseconds
 * @param {number} timeout
 * @private
 * @returns {Promise}
 */
function delay(timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}
/**
 * @method submitPassword
 * @memberof wd
 * @param {Object} user
 * @param {string} user.password
 * @param {Object} options
 * @param {Object} options.remainingRetries
 */
wd.addPromiseChainMethod('submitPassword', function submitPassword(user, options) {
  if (!user.password) {
    throw new Error('`user.password` is required');
  }

  options = options || {
    remainingRetries: 3
  };

  return this
    .elementById('IDToken2')
    .sendKeys(user.password)
    .elementById('Button1')
    .click()
    .hasElementByClassName('generic-error')
    .then((isPresent) => {
      if (isPresent) {
        if (options.remainingRetries > 0) {
          options.remainingRetries -= 1;

          return delay(1000)
            .then(() => {
              this.submitPassword(user, options);
            });
        }
        throw new Error('Failed to login after several attempts');
      }

      return null;
    });
});
