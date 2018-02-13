/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("chai").assert;

const DataStoreError = require("../lib/util/errors"),
      localdatabase = require("../lib/localdatabase"),
      constants = require("../lib/constants");

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
    await prep.version(2000);
    await prep.open();
    prep.close();

    try {
      ldb = await localdatabase.open(name);
      assert.ok(false, "unexpected success");
    } catch (err) {
      assert.strictEqual(err.reason, DataStoreError.LOCALDB_VERSION);
    }
  });

  describe("upgrades", () => {
    it("upgrades 0.1 ==> 0.2", async () => {
      const bucket = localdatabase.DEFAULT_BUCKET;

      // prepare "old" database
      const oldDB = new localdatabase.Dexie(bucket);
      localdatabase.VERSIONS["0.1"](oldDB);

      const record = {
        encrypted: require("./setup/encrypted-empty.json").encrypted,
        group: ""
      };
      await oldDB.open();
      await oldDB.keystores.add(record);
      await oldDB.close();

      const currDB = await localdatabase.open(bucket);
      const actual = await currDB.keystores.get(constants.DEFAULT_KEYSTORE_GROUP);
      const expected = {
        id: constants.DEFAULT_KEYSTORE_ID,
        group: constants.DEFAULT_KEYSTORE_GROUP,
        encrypted: record.encrypted
      };

      assert.deepEqual(actual, expected);
    });
  });
});
