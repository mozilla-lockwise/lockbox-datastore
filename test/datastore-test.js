/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("chai").assert;

const DataStore = require("../lib/datastore"),
      localdatabase = require("../lib/localdatabase"),
      errors = require("../lib/util/errors");

async function loadMasterPassword() {
  // master key contains secret
  let master = require("./setup/master-key.json");
  master = master.secret;
  return master;
}

function loadEncryptedKeys() {
  // keys is encrypted (using master password) as a Compact JWE
  let keys = require("./setup/encrypted-empty.json");
  keys = keys.encrypted;
  return keys;
}

function checkList(stored, cached) {
  assert.equal(stored.size, cached.size);
  for (let i of cached.keys()) {
    let actual = stored.get(i),
        expected = cached.get(i);
    assert.deepEqual(actual, expected);
  }
}

describe("datastore", () => {
  let unlockWin = loadMasterPassword;

  describe("ctor", () => {
    it("constructs an instance without any options", () => {
      let ds = new DataStore();
      assert.ok(!ds.initialized);
      assert.ok(ds.locked);
      assert.typeOf(ds.prompts.unlock, "function");
    });
    it("constructs with the specified configuration", () => {
      let cfg = {
        prompts: {
          unlock: unlockWin
        },
        keys: loadEncryptedKeys()
      };
      let ds = new DataStore(cfg);
      assert.ok(ds.initialized);
      assert.ok(ds.locked);
      assert.strictEqual(ds.prompts.unlock, unlockWin);
    });
    it("constructs an instance with configured prompts", () => {
      let cfg = {
        prompts: {
          unlock: unlockWin
        }
      };
      let ds = new DataStore(cfg);
      assert.ok(!ds.initialized);
      assert.ok(ds.locked);
      assert.strictEqual(ds.prompts.unlock, unlockWin);
    });
    it("constructs an instance with configured keystore", () => {
      let cfg = {
        keys: loadEncryptedKeys()
      };
      let ds = new DataStore(cfg);
      assert.ok(ds.initialized);
      assert.ok(ds.locked);
      assert.typeOf(ds.prompts.unlock, "function");
    });
  });

  describe("initialization", () => {
    beforeEach(localdatabase.startup);
    afterEach(localdatabase.teardown);
    function setupTest(password) {
      return async () => {
        let ds = new DataStore({
          prompts: {
            unlock: async () => password
          }
        });

        let result = await ds.initialize({ password });
        assert.strictEqual(result, ds);
        assert(!ds.locked);
        assert(ds.initialized);

        password = password || "";
        await ds.lock();
        await ds.unlock();
        assert(!ds.locked);

        return ds;
      };
    }

    it("initializes with given (non-empty) password", setupTest("P0ppy$33D!"));
    it("initializes with given (empty) password", setupTest(""));
    it("initializes with a null password (treated as '')", setupTest(null));
    it("fails on the second initialization", async () => {
      let first = setupTest("");
      let ds = await first();
      try {
        await ds.initialize({ password: "" });
      } catch (err) {
        assert.strictEqual(err.reason, errors.Reasons.GENERIC_ERROR);
        assert.strictEqual(err.message, "already initialized");
      }
    });
  });

  describe("CRUD", () => {
    let main;

    before(async () => {
      localdatabase.startup();

      main = new DataStore({
        prompts: {
          unlock: unlockWin
        },
        keys: loadEncryptedKeys()
      });
      main = await main.prepare();
    });
    after(async () => {
      // cleanup databases
      await localdatabase.teardown();
    });

    it("locks and unlocks", async () => {
      let result;

      assert.ok(main.locked);
      result = await main.unlock();
      assert.strictEqual(result, main);
      assert.ok(!main.locked);
      result = await main.lock();
      assert.strictEqual(result, main);
      assert.ok(main.locked);
    });

    it("does basic CRUD ops", async () => {
      // start by unlocking
      await main.unlock();
      let cached = new Map(),
          stored;
      stored = await main.list();
      checkList(stored, cached);

      let something = {
        title: "My Item",
        entry: {
          kind: "login",
          username: "foo",
          password: "bar"
        }
      };
      let result = await main.add(something);
      assert.deepNestedInclude(result, something);
      cached.set(result.id, result);
      stored = await main.list();
      checkList(stored, cached);

      // result is the full item
      let expected = result;
      result = await main.get(expected.id);
      assert(expected !== result);
      assert.deepEqual(result, expected);

      something = JSON.parse(JSON.stringify(result));
      something.entry = Object.assign(something.entry, {
        password: "baz"
      });
      result = await main.update(something);
      delete something.modified;  // NOTE: modified is updated -- skip for now

      assert.deepNestedInclude(result, something);
      cached.set(result.id, result);
      stored = await main.list();
      checkList(stored, cached);

      expected = result;
      result = await main.get(expected.id);
      assert(expected !== result);
      assert.deepEqual(result, expected);

      something = result;
      result = await main.remove(something.id);
      assert.deepEqual(result, something);
      cached.delete(result.id);
      stored = await main.list();
      checkList(stored, cached);

      result = await main.get(result.id);
      assert(!result);
    });
  });

  describe("defaults", () => {
    before(async () => {
      await localdatabase.startup();
    });
    after(async () => {
      await localdatabase.teardown();
    });

    it("initializes and unlocks with a default prompt handler", async () => {
      let ds = new DataStore();

      let result;
      result = await ds.initialize();
      assert.strictEqual(result, ds);
    });
  });

  describe("persistence", () => {
    let cached = new Map();
    let expectedID;
    let something = {
      title: "Sa Tuna2",
      entry: {
        kind: "login",
        username: "foo",
        password: "bar"
      }
    };

    before(async () => {
      localdatabase.startup();
    });
    after(async () => {
      // cleanup databases
      await localdatabase.teardown();
    });

    it("add a value to 1st datatore", async () => {
      let main = new DataStore({
        prompts: {
          unlock: unlockWin
        },
        keys: loadEncryptedKeys()
      });
      main = await main.prepare();
      await main.unlock;

      let result = await main.add(something);
      assert.deepNestedInclude(result, something);
      cached.set(result.id, result);
      let stored = await main.list();
      checkList(stored, cached);

      // result is the full item
      let expected = result;
      result = await main.get(expected.id);
      assert(expected !== result);
      assert.deepEqual(result, expected);

      expectedID = expected.id;
    });

    it("data persists into second datastore", async () => {
      let secondDatastore = new DataStore({
        prompts: {
          unlock: unlockWin
        },
        keys: loadEncryptedKeys()
      });
      secondDatastore = await secondDatastore.prepare();
      await secondDatastore.unlock();

      let stored = await secondDatastore.list();
      checkList(stored, cached);

      // result is the full item
      let result = await secondDatastore.get(expectedID);
      assert.deepNestedInclude(result, something);
    });
  });
});
