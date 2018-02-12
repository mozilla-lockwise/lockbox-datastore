/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("chai").assert,
      jose = require("node-jose"),
      UUID = require("uuid");

const ItemKeyStore = require("../lib/itemkeystore"),
      DataStoreError = require("../lib/util/errors");

async function loadMasterKey() {
  let bundle = require("./setup/key-bundle.json");
  let encryptKey = await jose.JWK.asKey(bundle.encryptKey);
  return encryptKey;
}
async function setupContext(context) {
  context = {
    encryptKey: await loadMasterKey(),
    ...context
  };

  return context;
}

describe("ItemKeyStore", () => {
  describe("ctor", () => {
    it("creates an ItemKeyStore", () => {
      let iks = new ItemKeyStore();
      assert.isEmpty(iks.group);
      assert.isUndefined(iks.encrypted);

      assert.deepEqual(iks.toJSON(), {
        group: "",
        encrypted: undefined
      });
    });
    it("creates an ItemKeyStore with the given (empty) configuration", () => {
      let context = {};
      let iks = new ItemKeyStore(context);
      assert.isEmpty(iks.group);
      assert.isUndefined(iks.encrypted);
      assert.deepEqual(iks.toJSON(), {
        group: "",
        encrypted: undefined
      });
    });
    it("creates an ItemKeyStore with the given configuration", () => {
      let context = {
        group: "my-group",
        encrypted: "not-real-data"
      };
      let expected = { ...context };

      let iks = new ItemKeyStore(context);
      assert.strictEqual(iks.group, expected.group);
      assert.strictEqual(iks.encrypted, expected.encrypted);
      assert.deepEqual(iks.toJSON(), expected);
    });
    it("creates an ItemKeyStore with prepopulated keys", async () => {
      let cache = new Map();
      for (let idx = 0; idx < 4; idx++) {
        let kid = UUID();
        let key = await jose.JWK.createKeyStore().generate("oct", 256, {kid});
        cache.set(kid, key);
      }

      let iks = new ItemKeyStore({
        listing: new Map(cache)
      });
      let all = await iks.all();
      assert(all !== cache);
      assert.deepEqual(all, cache);
      assert.strictEqual(iks.size, cache.size);
    });
  });

  describe("loading", () => {
    it("loads empty keys from encrypted", async () => {
      let context = await setupContext(require("./setup/encrypted-empty.json"));
      let iks = new ItemKeyStore(context);

      let result = await iks.load();
      assert.strictEqual(result, iks);
    });
    it("loads real keys from encrypted", async () => {
      let context = await setupContext(require("./setup/encrypted-4items.json"));
      let iks = new ItemKeyStore(context);

      let result = await iks.load();
      assert.strictEqual(result, iks);
    });
    it("loads with the given master key", async () => {
      let context = await setupContext(require("./setup/encrypted-4items.json"));
      let realKey = context.encryptKey;
      delete context.encryptKey;

      let iks = new ItemKeyStore(context);
      assert.isUndefined(iks.encryptKey);

      let result = await iks.load(realKey);
      assert.strictEqual(result, iks);
      assert.strictEqual(iks.encryptKey, realKey);
      assert.strictEqual(iks.size, 4);
    });
    it("fails with no encryptKey key", async () => {
      let context = await setupContext(require("./setup/encrypted-empty.json"));
      delete context.encryptKey;

      let iks = new ItemKeyStore(context);
      try {
        await iks.load();
        assert(false, "unexpected success");
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.MISSING_APP_KEY);
      }
    });
    it("fails with no encrypted data", async () => {
      let context = await setupContext();

      let iks = new ItemKeyStore(context);
      try {
        await iks.load();
        assert(false, "unexpected success");
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.CRYPTO);
        assert.strictEqual(err.message, `${DataStoreError.CRYPTO}: keystore not encrypted`);
      }
    });
  });
  describe("get/add/delete", () => {
    let iks,
        cache = new Map();

    before(async () => {
      iks = new ItemKeyStore();
    });

    it("adds a key", async () => {
      for (let idx = 0; 4 > idx; idx++) {
        let key, id = UUID();
        key = await iks.get(id);
        assert.isUndefined(key);
        key = await iks.add(id);
        assert.ok(jose.JWK.isKey(key));
        assert.strictEqual(key.kty, "oct");
        assert.strictEqual(key.kid, id);
        assert.strictEqual(key.alg, "A256GCM");
        cache.set(id, key);
      }
      assert.strictEqual(iks.size, 4);
      let all = await iks.all();
      assert.deepEqual(all, cache);
    });
    it("gets the same key", async () => {
      for (let c of cache.entries()) {
        let [ id, expected ] = c;
        let actual;

        actual = await iks.get(id);
        assert.strictEqual(actual, expected);

        actual = await iks.add(id);
        assert.strictEqual(actual, expected);
      }
      let all = await iks.all();
      assert.deepEqual(all, cache);
    });
    it("removes a key", async () => {
      for (let c of cache.entries()) {
        let [ id, expected ] = c;
        let actual;

        actual = await iks.get(id);
        assert.strictEqual(actual, expected);
        await iks.delete(id);
        actual = await iks.get(id);
        assert.isUndefined(actual);
      }
      assert.strictEqual(iks.size, 0);

      let all = await iks.all();
      assert.strictEqual(all.size, 0);
    });
  });
  describe("saving", () => {
    it("saves an empty ItemKeyStore", async () => {
      let context = {
        encryptKey: await loadMasterKey()
      };
      let iks = new ItemKeyStore(context);
      assert.isUndefined(iks.encrypted);

      let result = await iks.save();
      assert.strictEqual(result, iks);
      assert.isNotEmpty(iks.encrypted);
    });
    it("fails if there is no master key", async () => {
      let iks = new ItemKeyStore();
      assert.isUndefined(iks.encrypted);
      assert.isUndefined(iks.encryptKey);

      try {
        await iks.save();
        assert.ok(false, "unexpected success");
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.MISSING_APP_KEY);
      }
    });
  });
  describe("clearing", () => {
    it("clears a populated ItemKeyStore", async () => {
      let { encrypted } = require("./setup/encrypted-4items.json");
      let context = await setupContext({ encrypted });
      let iks = new ItemKeyStore(context);

      await iks.load();
      assert.strictEqual(iks.size, 4);

      let result = await iks.clear();
      assert.strictEqual(result, iks);
      assert.strictEqual(iks.size, 0);
      assert.isUndefined(iks.encryptKey);
      assert.strictEqual(iks.encrypted, encrypted);
    });
    it ("clears a populated ItemKeyStore of *everything*", async () => {
      let { encrypted } = require("./setup/encrypted-4items.json");
      let context = await setupContext({ encrypted });
      let iks = new ItemKeyStore(context);

      await iks.load();
      assert.strictEqual(iks.size, 4);

      let result = await iks.clear(true);
      assert.strictEqual(result, iks);
      assert.strictEqual(iks.size, 0);
      assert.isUndefined(iks.encryptKey);
      assert.isUndefined(iks.encrypted);
    });
  });

  describe("roundtrip", () => {
    let cache = [],
        encrypted;

    it("encrypts an new ItemKeyStore", async () => {
      let context = await setupContext(require("./setup/encrypted-empty.json"));
      let iks = new ItemKeyStore(context);

      for (let idx = 0; 4 > idx; idx++) {
        let id = UUID(),
            key = await iks.add(id);

        cache.push({
          id,
          key: key.toJSON(true)
        });
      }

      let result = await iks.save();
      assert.strictEqual(result, iks);
      encrypted = iks.encrypted;
      assert.isNotEmpty(encrypted);
    });
    it("decrypts a revived ItemKeyStore", async () => {
      let context = await setupContext({ encrypted });
      let iks = new ItemKeyStore(context);

      let result = await iks.load();
      assert.strictEqual(result, iks);
      for (let c of cache) {
        let {id, key: expected } = c;

        let actual = await iks.get(id);
        assert.deepEqual(actual.toJSON(true), expected);
      }
    });
  });

  describe("encrypt/decrypt items", () => {
    let cache, iks;

    function cacheEntry(id, item, encrypted) {
      cache.set(id, {
        id,
        item,
        encrypted
      });
    }

    before(async () => {
      let context = await setupContext(require("./setup/encrypted-empty.json"));
      iks = new ItemKeyStore(context);
      iks = await iks.load();
      cache = new Map();
    });

    it("encrypts an item with a new key", async () => {
      let item = {
        id: UUID(),
        title: "some item"
      };

      assert.strictEqual(iks.size, 0);
      let result = await iks.protect(item);
      assert.isNotEmpty(result);

      cacheEntry(item.id, item, result);
    });
    it("encrypts an item with a known key", async () => {
      let item = {
        id: UUID(),
        title: "another item"
      };
      let key = await iks.add(item.id);
      assert.isUndefined(cache.get(item.id));
      assert.isDefined(key);

      let result = await iks.protect(item);
      assert.isNotEmpty(result);

      cacheEntry(item.id, item, result);
    });
    it("decrypts items", async () => {
      assert.strictEqual(iks.size, cache.size);
      for (let c of cache.entries()) {
        let [ id, entry ] = c;
        let { item, encrypted } = entry;

        let result = await iks.unprotect(id, encrypted);
        assert.deepEqual(result, item);
      }
    });
  });
});
