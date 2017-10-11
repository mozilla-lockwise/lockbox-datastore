/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("chai").assert;

const DataStoreError = require("../lib/util/errors"),
      localdatabase = require("../lib/localdatabase");

describe("localdatabase", () => {
  let ldb;

  beforeEach(async () => {
    ldb = null;
    await localdatabase.startup();
  });
  afterEach(async () => {
    if (ldb) {
      await ldb.close();
    }
    await localdatabase.teardown();
  });

  it("opens a default instance", async () => {
    ldb = await localdatabase.open();
    assert.strictEqual(ldb.name, localdatabase.DEFAULT_BUCKET);
  });
  it("opens the named instance", async () => {
    const name = "lockbox-devel";
    ldb = await localdatabase.open(name);
    assert.strictEqual(ldb.name, name);
  });
  it("fails to open an unexpected instance", async () => {
    const name = "lockbox-bad";
    let prep = await localdatabase.open(name);
    await prep.close();
    await prep.version(0.2);
    try {
      ldb = await localdatabase.open(name);
    } catch (err) {
      console.log(`failure ${err.message}`); //eslint-disable-line
      assert.strictEqual(err.reason, DataStoreError.LOCALDB_VERSION);
    }
  });
});
