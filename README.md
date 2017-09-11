[![Build Status][travis-image]][travis-link]
[![Coverage Status][codecov-image]][codecov-link]


# Lockbox DataStore #

The data storage module for Lockbox. This module maintains the collection of entries, protected behind a preconfigured secret.

Items persisted to storage are encrypted.

## Installing ##

To use `lockbox-datastore` in your own projects, install it from the repository:

```bash
npm install --save git+https://github.com/mozilla-lockbox/lockbox-datastore.git
```

## Building ##

To build `lockbox-datastore`, first clone this repository then install dependencies:

```bash
git clone https://github.com/mozilla-lockbox/lockbox-datastore.git
cd lockbox-datastore
npm install
```

To run tests in a web browser:

```bash
npm test
```

## Contributing ##

See the [guidelines](./CONTRIBUTING.md) for contributing to this project.

This project is governed by a [Code Of Conduct](./CODE_OF_CONDUCT.md).

## License

This module is licensed under the [Mozilla Public License,
version 2.0](./LICENSE).

[travis-image]: https://travis-ci.org/mozilla-lockbox/lockbox-datastore.svg?branch=master
[travis-link]: https://travis-ci.org/mozilla-lockbox/lockbox-datastore
[codecov-image]: https://img.shields.io/codecov/c/github/mozilla-lockbox/lockbox-datastore.svg
[codecov-link]: https://codecov.io/gh/mozilla-lockbox/lockbox-datastore
