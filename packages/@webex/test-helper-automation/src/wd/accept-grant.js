/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable no-invalid-this */

const wd = require('wd');

wd.addPromiseChainMethod('acceptGrant', function acceptGrant() {
  const selector = 'input[value="Accept"]';

  return this
    .hasElementByCssSelector(selector)
    .then((has) => {
      if (has) {
        return this
          .waitForElementByCssSelector(selector)
          .click();
      }

      return this;
    });
});
