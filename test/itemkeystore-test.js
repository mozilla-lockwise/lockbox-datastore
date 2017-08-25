/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("chai").assert,
      jose = require("node-jose"),
      UUID = require("uuid");

const ItemKeyStore = require("../lib/itemkeystore");

async function loadMasterKey() {
  let masterKey = require("./setup/master-key.json");
  masterKey = await jose.JWK.asKey(masterKey);
  return masterKey;
}
async function setupContext(context) {
  context = {
    salt: jose.util.randomBytes(32),
    iterations: 8192,
    masterKey: await loadMasterKey(),
    ...context
  };

  return context;
}

describe("ItemKeyStore", () => {
  describe("ctor", () => {
    it("creates an ItemKeyStore", () => {
      let itemstore = new ItemKeyStore();
      assert.isNotEmpty(itemstore.instance);
      assert.isUndefined(itemstore.encrypted);
    });
    it("creates an ItemKeyStore with the given (empty) configuration", () => {
      let context = {};
      let itemstore = new ItemKeyStore(context);
      assert.strictEqual(itemstore.instance, context);
      assert.isUndefined(itemstore.encrypted);
    });
    it("creates an ItemKeyStore with the given configuration", () => {
      let context = {
        encrypted: "not-real-data",
        salt: jose.util.randomBytes(32),
        iterations: 8192
      };
      let itemstore = new ItemKeyStore(context);
      assert.strictEqual(itemstore.instance, context);
      assert.strictEqual(itemstore.encrypted, context.encrypted);
    });
  });

  describe("loading", () => {
    it("loads empty keys from encrypted", async () => {
      let context = await setupContext(require("./setup/encrypted-empty.json"));
      let itemstore = new ItemKeyStore(context);

      let result = await itemstore.load();
      assert.strictEqual(result, itemstore);
    });
    it("loads real keys from encrypted", async () => {
      let context = await setupContext(require("./setup/encrypted-4items.json"));
      let itemstore = new ItemKeyStore(context);

      let result = await itemstore.load();
      assert.strictEqual(result, itemstore);
    });
    it("loads with the given master key", async () => {
      let context = await setupContext(require("./setup/encrypted-4items.json"));
      let realKey = context.masterKey;
      delete context.masterKey;

      let itemstore = new ItemKeyStore(context);
      assert.isUndefined(itemstore.masterKey);

      let result = await itemstore.load(realKey);
      assert.strictEqual(result, itemstore);
      assert.strictEqual(itemstore.masterKey, realKey);
      assert.strictEqual(itemstore.size, 4);
    });
    it("fails with no masterKey key", async () => {
      let context = await setupContext(require("./setup/encrypted-empty.json"));
      delete context.masterKey;

      let itemstore = new ItemKeyStore(context);
      try {
        let result = await itemstore.load();
        assert(false, "unexpected success");
      } catch (err) {
        assert.strictEqual(err.message, "invalid master key");
      }
    });
    it("fails with no encrypted data", async () => {
      let context = await setupContext();

      let itemstore = new ItemKeyStore(context);
      try {
        let result = await itemstore.load();
        assert(false, "unexpected success");
      } catch (err) {
        assert.strictEqual(err.message, "not encrypted");
      }
    });
  });
  describe("get/add/delete", () => {
    let itemstore,
        cache = [];

    before(async () => {
      itemstore = new ItemKeyStore();
    });

    it("adds a key", async () => {
      for (let idx = 0; 4 > idx; idx++) {
        let key, id = UUID();
        key = await itemstore.get(id);
        assert.isUndefined(key);
        key = await itemstore.add(id);
        assert.ok(jose.JWK.isKey(key));
        assert.strictEqual(key.kty, "oct");
        assert.strictEqual(key.kid, id);
        assert.strictEqual(key.alg, "A256GCM");
        cache.push({ id, key });
      }
      assert.strictEqual(itemstore.size, 4);
    });
    it("gets the same key", async () => {
      for (let c of cache) {
        let { id, key: expected } = c;
        let actual;

        actual = await itemstore.get(id);
        assert.strictEqual(actual, expected);

        actual = await itemstore.add(id);
        assert.strictEqual(actual, expected);
      }
    });
    it("removes a key", async () => {
      for (let c of cache) {
        let { id, key: expected } = c;
        let actual;

        actual = await itemstore.get(id);
        assert.strictEqual(actual, expected);
        await itemstore.delete(id);
        actual = await itemstore.get(id);
        assert.isUndefined(actual);
      }
      assert.strictEqual(itemstore.size, 0);
    });
  });
  describe("saving", () => {
    it("saves an empty ItemKeyStore", async () => {
      let context = {
        masterKey: await loadMasterKey()
      };
      let itemstore = new ItemKeyStore(context);
      assert.isUndefined(itemstore.encrypted);
      assert.isUndefined(context.salt);
      assert.isUndefined(context.iterations);

      let result = await itemstore.save();
      assert.isNotEmpty(itemstore.encrypted);
      assert.isDefined(context.salt);
      assert.strictEqual(context.iterations, 8192);
    });
    it("fails if there is no master key", async () => {
      let itemstore = new ItemKeyStore();
      assert.isUndefined(itemstore.encrypted);
      assert.isUndefined(itemstore.masterKey);

      try {
        let result = await itemstore.save();
        assert.ok(false, "unexpected success");
      } catch (err) {
        assert.strictEqual(err.message, "invalid master key");
      }
    });
  });
  describe("clearing", () => {
    it ("clears a populated ItemKeyStore", async () => {
      let context = await setupContext(require("./setup/encrypted-4items.json"));
      let itemstore = new ItemKeyStore(context);

      await itemstore.load();
      assert.strictEqual(itemstore.size, 4);

      let result = await itemstore.clear();
      assert.strictEqual(result, itemstore);
      assert.strictEqual(itemstore.size, 0);
      assert.isUndefined(itemstore.masterKey);
    });
  });

  describe("roundtrip", () => {
    let cache = [],
        encrypted;

    it("encrypts an new ItemKeyStore", async () => {
      let context = await setupContext(require("./setup/encrypted-empty.json"));
      let itemstore = new ItemKeyStore(context);

      for (let idx = 0; 4 > idx; idx++) {
        let id = UUID(),
            key = await itemstore.add(id);

        cache.push({
          id,
          key: key.toJSON(true)
        });
      }

      let result = await itemstore.save();
      assert.strictEqual(result, itemstore);
      encrypted = itemstore.encrypted;
      assert.isNotEmpty(encrypted);
    });
    it("decrypts a revived ItemKeyStore", async () => {
      let context = await setupContext({ encrypted });
      let itemstore = new ItemKeyStore(context);

      let result = await itemstore.load();
      assert.strictEqual(result, itemstore);
      for (let c of cache) {
        let {id, key: expected } = c;

        let actual = await itemstore.get(id);
        assert.deepEqual(actual.toJSON(true), expected);
      }
    });
  });

  describe("encrypt/decrypt items", () => {
    let cache, itemstore;

    function cacheEntry(id, item, encrypted) {
      cache.set(id, {
        id,
        item,
        encrypted
      });
    }

    before(async () => {
      let context = await setupContext(require("./setup/encrypted-empty.json"));
      itemstore = new ItemKeyStore(context);
      itemstore = await itemstore.load();
      cache = new Map();
    });

    it("encrypts an item with a new key", async () => {
      let item = {
        id: UUID(),
        title: "some item"
      };

      assert.strictEqual(itemstore.size, 0);
      let result = await itemstore.encrypt(item);
      assert.isNotEmpty(result);

      cacheEntry(item.id, item, result);
    });
    it("encrypts an item with a known key", async () => {
        let item = {
          id: UUID(),
          title: "another item"
        };
        let key = await itemstore.add(item.id);
        assert.isUndefined(cache.get(item.id));
        assert.isDefined(key);

        let result = await itemstore.encrypt(item);
        assert.isNotEmpty(result);

        cacheEntry(item.id, item, result);
    });
    it("decrypts items", async () => {
      assert.strictEqual(itemstore.size, cache.size);
      for (let c of cache.entries()) {
        let [ id, entry ] = c;
        let { item, encrypted } = entry;

        let result = await itemstore.decrypt(id, encrypted);
        assert.deepEqual(result, item);
      }
    });
  });
});
