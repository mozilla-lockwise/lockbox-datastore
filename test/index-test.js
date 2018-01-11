/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("chai").assert;

const index = require("../lib"),
      DataStore = require("../lib/datastore"),
      DataStoreError = require("../lib/util/errors");

describe("index", () => {
  it("has expected symbols", () => {
    assert.strictEqual(index.DataStoreError, DataStoreError);
    assert.strictEqual(index.DataStore, DataStore);
    assert.typeOf(index.open, "function");
  });
  it("opens a DataStore instance", async () => {
    let data = index.open();
    // make sure it quacks enough like a duck
    assert.typeOf(data.then, "function");
    assert.typeOf(data.catch, "function");

    data = await data;
    assert.instanceOf(data, DataStore);
  });
});
