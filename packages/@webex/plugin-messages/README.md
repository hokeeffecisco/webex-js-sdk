# @webex/plugin-messages

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Messages plugin for the Cisco Webex JS SDK.

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @webex/plugin-messages
```

## Usage

This is a plugin for the Cisco Webex JS SDK. While most of the functionality of this plugin can be utilized using specific scopes, such as `spark:messages_read` and `spark:messages_write`, utilizing the `listen()` method of this plugin will require both `spark:all` and `spark:kms`. Please note that by toggling an application's `spark:all` scope via the portal will also toggle its `spark:kms` scope. Please see our [developer portal](https://developer.webex.com/) and the [API docs](https://webex.github.io/webex-js-sdk/api/) for full details.

## Install

```bash
npm install --save @webex/plugin-messages
```

## Usage

```js

const Webex = require('webex');

const webex = Webex.init();
webex.messages.get(id)
  .then((message) => {
    console.log(message);
  })

```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
