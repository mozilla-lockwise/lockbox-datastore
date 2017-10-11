/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const DataStore = require("./datastore"),
      DataStoreError = require("./util/errors");

/**
 * Creates a new {DataStore} using the given configuration, and prepares it
 * for use.  This method calls {@link DataStore#prepare}, returning the
 * (promised) DataStore once it's ready for use.
 *
 * The signature for `{recordMetric}` (if provided) should conform to
 *  the following:
 *
 * ```
 * async function recordMetric(method, id, fields) {
 *   // {method} is one of "added" | "updated" | "deleted"
 *   // {id} is the item.id
 *   // {fields} either:
 *   // * array strings denoting which fields were changed (if method === "updated")
 *   // * undefined (otherwise)
 * }
 * ```
 *
 * @param {Object} [cfg] - The configuration parameters
 * @param {String} [cfg.bucket="lockbox"] - The bucket to persist data to
 * @param {Function} [cfg.recordMetric] - The function to record item metrics
 *        events
 * @returns {DataStore} A new (prepared) DataStore
 */
async function open(cfg) {
  return (new DataStore(cfg)).prepare();
}

Object.assign(exports, {
  DataStoreError,
  open
});
