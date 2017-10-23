/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const jsonmergepatch = require("json-merge-patch"),
      joi = require("joi"),
      UUID = require("uuid");
      
const DataStoreError = require("./util/errors");

const BASE_ENTRY_SCHEMA = joi.object().keys({
  kind: joi.string().required(),
  notes: joi.string().max(10000),
});
const ENTRY_SCHEMAS = [
  BASE_ENTRY_SCHEMA.keys({
    kind: "login",
    username: joi.string().max(500),
    password: joi.string().max(500),
  }),
];
const SCHEMA = joi.object().keys({
  title: joi.string().max(500),
  origins: joi.array().items(joi.string().max(500)).max(5),
  tags: joi.array().items(joi.string().max(500)).max(10),
  entry: joi.alternatives(ENTRY_SCHEMAS).required(),
});

const HISTORY_MAX = 100;

function prepare(item, source) {
  // strip out anything not in the whitelist
  let { error, value: destination } = SCHEMA.validate(item, { stripUnknown: true });
  if (error) {
    throw new DataStoreError("item changes invalid", DataStoreError.INVALID_ITEM);
  }
  
  // apply read-only values
  source = source || {};
  destination.id = source.id || UUID();
  destination.created = source.created || new Date().toISOString();
  destination.modified = source.modified || new Date().toISOString();
  destination.disabled = source.disabled || false;
  
  // generate history patch (to go backward)
  let dstEntry = destination.entry,
      srcEntry = source.entry || {};
  let patch = jsonmergepatch.generate(dstEntry, srcEntry);
  let history = (source.history || []).slice(0, HISTORY_MAX - 1);
  history.shift({
    created: new Date().toISOString(),
    patch
  });
  destination.history = history;
  return destination;
}

Object.assign(exports, {
  prepare
});
