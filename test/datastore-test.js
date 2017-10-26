/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("./setup/assert");

const UUID = require("uuid"),
      jsonmergepatch = require("json-merge-patch");

const DataStore = require("../lib/datastore"),
      localdatabase = require("../lib/localdatabase"),
      DataStoreError = require("../lib/util/errors");

function loadMasterPassword() {
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
  describe("ctor", () => {
    it("constructs an instance without any options", () => {
      let ds = new DataStore();
      assert.ok(!ds.initialized);
      assert.ok(ds.locked);
    });
    it("constructs with the specified configuration", () => {
      let cfg = {
        keys: loadEncryptedKeys()
      };
      let ds = new DataStore(cfg);
      assert.ok(ds.initialized);
      assert.ok(ds.locked);
    });
  });

  describe("initialization & reset", () => {
    beforeEach(localdatabase.startup);
    afterEach(localdatabase.teardown);
    function setupTest(password) {
      return async () => {
        let ds = new DataStore();

        let result = await ds.initialize({ password });
        assert.strictEqual(result, ds);
        assert(!ds.locked);
        assert(ds.initialized);

        password = password || "";
        await ds.lock();
        await ds.unlock(password);
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
        assert.strictEqual(err.reason, DataStoreError.INITIALIZED);
        assert.strictEqual(err.message, "already initialized");
      }
    });
    it("resets an initialized datatore", async () => {
      let ds = await setupTest("")();

      assert(ds.initialized);

      let result;
      result = await ds.reset();
      assert(!ds.initialized);
      assert.strictEqual(result, ds);
    });
    it("resets an uninitialized datatore", async () => {
      let ds = new DataStore();

      assert(!ds.initialized);

      let result;
      result = await ds.reset();
      assert(!ds.initialized);
      assert.strictEqual(result, ds);
    });
    it("resets and reinitializes a datastore", async () => {
      let ds = await setupTest("")();

      assert(ds.initialized);

      let result;
      result = await ds.reset();
      assert(!ds.initialized);
      assert.strictEqual(result, ds);

      result = await ds.initialize({
        password: ""
      });
      assert(ds.initialized);
      assert.strictEqual(result, ds);
    });
  });

  describe("CRUD", () => {
    let main, masterPwd, metrics;

    function checkMetrics(expected) {
      let actual = metrics;
      metrics = [];

      assert.equal(actual.length, expected.length);
      for (let idx = 0; idx < expected.length; idx++) {
        assert.deepEqual(actual[idx], expected[idx]);
      }
    }

    before(async () => {
      await localdatabase.startup();

      metrics = [];
      main = new DataStore({
        keys: loadEncryptedKeys(),
        recordMetric: async (method, id, fields) => {
          metrics.push({method, id, fields});
        }
      });
      main = await main.prepare();
      masterPwd = loadMasterPassword();
    });
    after(async () => {
      // cleanup databases
      await localdatabase.teardown();
    });

    it("locks and unlocks", async () => {
      let result;

      assert.ok(main.locked);
      result = await main.unlock(masterPwd);
      assert.strictEqual(result, main);
      assert.ok(!main.locked);
      result = await main.lock();
      assert.strictEqual(result, main);
      assert.ok(main.locked);
    });

    it("does basic CRUD ops", async () => {
      // start by unlocking
      await main.unlock(masterPwd);
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
      let result, expected, history = [];
      result = await main.add(something);
      assert.itemMatches(result, Object.assign({}, something, {
        modified: new Date().toISOString(),
        history
      }));
      cached.set(result.id, result);
      stored = await main.list();
      checkList(stored, cached);
      checkMetrics([
        {
          method: "added",
          id: result.id,
          fields: undefined
        }
      ]);

      // result is the full item
      expected = result;
      result = await main.get(expected.id);
      assert(expected !== result);
      assert.deepEqual(result, expected);

      something = JSON.parse(JSON.stringify(result));
      something.entry = Object.assign(something.entry, {
        password: "baz"
      });
      history.unshift({
        created: new Date().toISOString(),
        patch: jsonmergepatch.generate(something.entry, expected.entry)
      });
      result = await main.update(something);

      assert.itemMatches(result, Object.assign({}, something, {
        modified: new Date().toISOString(),
        history
      }));
      cached.set(result.id, result);
      stored = await main.list();
      checkList(stored, cached);
      checkMetrics([
        {
          method: "updated",
          id: result.id,
          fields: "entry.password"
        }
      ]);

      expected = result;
      result = await main.get(expected.id);
      assert(expected !== result);
      assert.deepEqual(result, expected);

      something = JSON.parse(JSON.stringify(result));
      something = Object.assign(something, {
        title: "MY Item"
      });
      something.entry = Object.assign(something.entry, {
        username: "another-user",
        password: "zab"
      });
      history.unshift({
        created: new Date().toISOString(),
        patch: jsonmergepatch.generate(something.entry, expected.entry)
      });
      result = await main.update(something);

      assert.itemMatches(result, Object.assign({}, something, {
        modified: new Date().toISOString(),
        history
      }));
      cached.set(result.id, result);
      stored = await main.list();
      checkList(stored, cached);
      checkMetrics([
        {
          method: "updated",
          id: result.id,
          fields: "title,entry.username,entry.password"
        }
      ]);

      expected = result;
      result = await main.get(expected.id);
      assert(expected !== result);
      assert.deepEqual(result, expected);

      something = JSON.parse(JSON.stringify(result));
      something = Object.assign(something, {
        title: "My Someplace Item",
        origins: ["someplace.example"]
      });
      result = await main.update(something);

      assert.itemMatches(result, Object.assign({}, something, {
        modified: new Date().toISOString(),
        history
      }));
      cached.set(result.id, result);
      stored = await main.list();
      checkList(stored, cached);
      checkMetrics([
        {
          method: "updated",
          id: result.id,
          fields: "title,origins"
        }
      ]);

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
      checkMetrics([
        {
          method: "deleted",
          id: result.id,
          fields: undefined
        }
      ]);

      result = await main.get(result.id);
      assert(!result);
    });

    describe("locked failures", () => {
      const item = {
        id: UUID(),
        title: "foobar",
        entry: {
          kind: "login",
          username: "blah",
          password: "dublah"
        }
      };

      beforeEach(async () => {
        await main.lock();
      });

      it("fails list if locked", async () => {
        try {
          await main.list();
        } catch (err) {
          assert.strictEqual(err.reason, DataStoreError.LOCKED);
        }
      });
      it("fails get if locked", async () => {
        try {
          await main.get(item.id);
        } catch (err) {
          assert.strictEqual(err.reason, DataStoreError.LOCKED);
        }
      });
      it("fails add if locked", async () => {
        try {
          await main.add(item);
        } catch (err) {
          assert.strictEqual(err.reason, DataStoreError.LOCKED);
        }
      });
      it("fails update if locked", async () => {
        try {
          await main.update(item);
        } catch (err) {
          assert.strictEqual(err.reason, DataStoreError.LOCKED);
        }
      });
      it("fails remove if locked", async () => {
        try {
          await main.remove(item);
        } catch (err) {
          assert.strictEqual(err.reason, DataStoreError.LOCKED);
        }
      });
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
      let main = new DataStore();
      main = await main.prepare();
      await main.initialize();
      await main.unlock();

      let result = await main.add(something);
      assert.itemMatches(result, something);
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
      let secondDatastore = new DataStore();
      secondDatastore = await secondDatastore.prepare();
      await secondDatastore.unlock();

      let stored = await secondDatastore.list();
      checkList(stored, cached);

      // result is the full item
      let result = await secondDatastore.get(expectedID);
      assert.itemMatches(result, something);
    });
  });
});
