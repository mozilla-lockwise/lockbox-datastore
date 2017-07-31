/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** @module datastore */

const DataStore = require("./datastore");

/**
 * Creates a new {DataStore} using the given configuration.
 *
 * @param {Object} cfg The configuration parameters
 * @returns {DataStore} A new DataStore
 */
function create(cfg) {
  return new DataStore(cfg);
}

Object.assign(exports, {
  create
});
