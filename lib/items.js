/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const jsonmergepatch = require("json-merge-patch"),
      joi = require("joi"),
      UUID = require("uuid");

const DataStoreError = require("./util/errors");

const STRING_500 = joi.string().max(500).allow("").allow(null).default("");
const STRING_10K = joi.string().max(10000).allow("").allow(null).default("");
const BASE_ENTRY_SCHEMA = joi.object().keys({
  kind: joi.string().required(),
  notes: STRING_10K
});
const ENTRY_SCHEMAS = [
  BASE_ENTRY_SCHEMA.keys({
    kind: "login",
    username: STRING_500,
    password: STRING_500
  }),
];
const SCHEMA = joi.object().keys({
  title: STRING_500,
  origins: joi.array().items(STRING_500).max(5).default([]),
  tags: joi.array().items(STRING_500).max(10).default([]),
  entry: joi.alternatives(ENTRY_SCHEMAS).required(),
});
const VALIDATE_OPTIONS = {
  abortEarly: false,
  stripUnknown: true
};

const HISTORY_MAX = 100;

function prepare(item, source) {
  // strip out anything not in the whitelist
  let { error, value: destination } = SCHEMA.validate(item, VALIDATE_OPTIONS);
  if (error) {
    let details = error.details;
    let thrown = new DataStoreError(DataStoreError.INVALID_ITEM);
    thrown.details = {};
    details.forEach((d) => {
      let path = Array.isArray(d.path) ? d.path.join(".") : d.path;
      thrown.details[path] = d.type;
    });
    throw thrown;
  }

  // apply read-only values
  source = source || {};
  destination.id = source.id || UUID();
  destination.disabled = source.disabled || false;
  destination.created = source.created || new Date().toISOString();
  // always assume the item is modified
  destination.modified = new Date().toISOString();

  // generate history patch (to go backward)
  let history = [];
  if (source && source.entry) {
    history = (source.history || []).slice(0, HISTORY_MAX - 1);
    let dstEntry = destination.entry,
        srcEntry = source.entry;
    let patch = jsonmergepatch.generate(dstEntry, srcEntry);
    if (undefined !== patch) {
      history.unshift({
        created: new Date().toISOString(),
        patch
      });
    }
  }
  destination.history = history;

  return destination;
}

Object.assign(exports, {
  prepare
});
