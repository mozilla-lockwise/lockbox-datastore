/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("./setup/assert");


const jsonmergepatch = require("json-merge-patch"),
      UUID = require("uuid");

const DataStoreError = require("../lib/util/errors"),
      Items = require("../lib/items");

const ITEM_MEMBERS = [ "id", "title", "origins", "tags", "entry", "disabled", "created", "modified", "history", "last_used" ];
const ENTRY_MEMBERS = ["kind", "username", "password", "notes"];
describe("items", () => {
  describe("happy", () => {
    it("prepares an item with all mutables and no source", () => {
      let item = {
        title: "some title",
        origins: ["example.com"],
        tags: ["personal"],
        entry: {
          kind: "login",
          username: "someone",
          password: "secret",
          notes: "some notes for the entry"
        }
      };

      let result = Items.prepare(item);
      assert(item !== result);
      assert.hasAllKeys(result, ITEM_MEMBERS);
      assert.hasAllKeys(result.entry, ENTRY_MEMBERS);
      assert.itemMatches(result, Object.assign({}, item, {
        disabled: false,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        last_used: null,
        history: []
      }));
    });
    it("prepares an item with all mutables and a source", () => {
      let history = [];
      let source = {
        id: UUID(),
        title: "some title",
        origins: ["example.com"],
        tags: ["personal"],
        entry: {
          kind: "login",
          username: "someone",
          password: "secret"
        },
        disabled: false,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        last_used: null,
        history: []
      };
      let item = {
        title: "some title",
        origins: ["example.net"],
        tags: ["personal"],
        entry: {
          kind: "login",
          username: "someone",
          password: "another-secret",
          notes: "my personal account details"
        }
      };
      history.unshift({
        created: new Date().toISOString(),
        patch: jsonmergepatch.generate(item.entry, source.entry)
      });

      let result = Items.prepare(item, source);
      assert(result !== item);
      assert(result !== source);
      assert.itemMatches(result, Object.assign({}, source, item, {
        modified: new Date().toISOString(),
        history
      }));
    });
    it("prepares an item with some mutables and no source", () => {
      let item = {
        title: "some title",
        origins: ["example.com"],
        entry: {
          kind: "login",
          username: "someone",
          password: "secret"
        }
      };

      let result = Items.prepare(item);
      assert(result !== item);
      assert.hasAllKeys(result, ITEM_MEMBERS);
      assert.itemMatches(result, Object.assign({}, item, {
        disabled: false,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        last_used: null,
        history: []
      }));
    });
    it("prepares an item with some mutables and a source", () => {
      let history = [];
      let source = {
        id: UUID(),
        title: "some title",
        origins: ["example.net"],
        tags: ["personal"],
        entry: {
          kind: "login",
          username: "someone",
          password: "secret"
        }
      };
      let item = {
        title: "some title",
        origins: ["example.com"],
        entry: {
          kind: "login",
          username: "someone@example.com",
          password: "secret"
        }
      };
      history.unshift({
        created: new Date().toISOString(),
        patch: jsonmergepatch.generate(item.entry, source.entry)
      });

      let result = Items.prepare(item, source);
      assert(result !== item);
      assert.hasAllKeys(result, ITEM_MEMBERS);
      assert.itemMatches(result, Object.assign({}, source, item, {
        tags: [],
        disabled: false,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        last_used: null,
        history
      }));
    });
    it("prepares an item without extras", () => {
      let item = {
        title: "some title",
        extra: ["EXTRA!", "READ", "ALL", "ABOUT", "IT!"],
        entry: {
          kind: "login",
          username: "someone"
        }
      };

      let result = Items.prepare(item);
      assert(result !== item);
      assert.hasAllKeys(result, ITEM_MEMBERS);
      assert.hasAllKeys(result.entry, ENTRY_MEMBERS);
    });
  });

  describe("sad", () => {
    function packString(max) {
      const ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ";
      let out = [];
      let len = Math.ceil(max + 1.5);
      for (let idx = 0; idx < len; idx++) {
        let c = Math.floor(Math.random() * ALPHA.length);
        c = ALPHA.charAt(c);
        out.push(c);
      }
      return out.join("");
    }
    function packOrigins(item) {
      for (let idx = 0; idx < 17; idx++) {
        item.origins.push(`domain-${idx}.example`);
      }
      return item;
    }
    function packTags(item) {
      for (let idx = 0; idx < 17; idx++) {
        item.tags.push(`personal-${idx}`);
      }
      return item;
    }

    it("fails to prepare an item without an entry", () => {
      let item = {
        title: "some title",
        origins: ["example.com"],
        tags: ["personal"],
      };

      try {
        Items.prepare(item);
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.INVALID_ITEM);
        assert.deepEqual(err.details, {
          entry: "any.required"
        });
      }
    });
    it("fails to prepare an item with an entry without a kind", () => {
      let item = {
        title: "some title",
        origins: ["example.com"],
        tags: ["personal"],
        entry: {
          username: "someone",
          password: "secret"
        }
      };

      try {
        Items.prepare(item);
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.INVALID_ITEM);
        assert.deepEqual(err.details, {
          entry: "any.required"
        });
      }
    });
    it("fails to prepare an item with excessive title", () => {
      let item = {
        title: packString(500),
        origins: ["example.com"],
        tags: ["personal"],
        entry: {
          kind: "login",
          username: "someone",
          password: "secret"
        }
      };

      try {
        Items.prepare(item);
        assert(false, "expected failure");
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.INVALID_ITEM);
        assert.deepEqual(err.details, {
          title: "string.max"
        });
      }
    });
    it("fails to prepare an item with excessive origin item", () => {
      let item = {
        title: "some title",
        origins: [packString(500)],
        tags: ["personal"],
        entry: {
          kind: "login",
          username: "someone",
          password: "secret"
        }
      };

      try {
        Items.prepare(item);
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.INVALID_ITEM);
        assert.deepEqual(err.details, {
          origins: "string.max"
        });
      }
    });
    it("fails to prepare an item with too many origins", () => {
      let item = {
        title: "some title",
        origins: ["example.com"],
        tags: ["personal"],
        entry: {
          kind: "login",
          username: "someone",
          password: "secret"
        }
      };
      item = packOrigins(item);

      try {
        Items.prepare(item);
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.INVALID_ITEM);
        assert.deepEqual(err.details, {
          origins: "array.max"
        });
      }
    });
    it("fails to prepare an item with excessive tag item", () => {
      let item = {
        title: "some title",
        origin: ["example.com"],
        tags: [packString(500)],
        entry: {
          kind: "login",
          username: "someone",
          password: "secret"
        }
      };

      try {
        Items.prepare(item);
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.INVALID_ITEM);
        assert.deepEqual(err.details, {
          tags: "string.max"
        });
      }
    });
    it("fails to prepare an item with too many tags", () => {
      let item = {
        title: "some title",
        origins: ["example.com"],
        tags: ["personal"],
        entry: {
          kind: "login",
          username: "someone",
          password: "secret",
          notes: "some notes"
        }
      };
      item = packTags(item);

      try {
        Items.prepare(item);
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.INVALID_ITEM);
        assert.deepEqual(err.details, {
          tags: "array.max"
        });
      }
    });
    it("fails to prepare an item with excessive entry.username", () => {
      let item = {
        title: "some title",
        origins: ["example.com"],
        tags: ["personal"],
        entry: {
          kind: "login",
          username: packString(500),
          password: "secret",
          notes: "some notes"
        }
      };

      try {
        Items.prepare(item);
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.INVALID_ITEM);
        assert.deepEqual(err.details, {
          "entry.username": "string.max"
        });
      }
    });
    it("fails to prepare an item with excessive entry.password", () => {
      let item = {
        title: "some title",
        origins: ["example.com"],
        tags: ["personal"],
        entry: {
          kind: "login",
          username: "someone",
          password: packString(500),
          notes: "some notes"
        }
      };

      try {
        Items.prepare(item);
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.INVALID_ITEM);
        assert.deepEqual(err.details, {
          "entry.password": "string.max"
        });
      }
    });
    it("fails to prepare an item with excessive entry.notes", () => {
      let item = {
        title: "some title",
        origins: ["example.com"],
        tags: ["personal"],
        entry: {
          kind: "login",
          username: "someone",
          password: "secret",
          notes: packString(10000)
        }
      };

      try {
        Items.prepare(item);
        assert(false, "expected failure");
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.INVALID_ITEM);
        assert.deepEqual(err.details, {
          "entry.notes": "string.max"
        });
      }
    });
    it("fails to prepare an item with multiple problems", () => {
      let item = {
        title: packString(500),
        origins: ["example.com"],
        tags: ["personal"],
        entry: {
          kind: "login",
          username: packString(500),
          password: "secret",
          notes: packString(10000)
        }
      };
      item = packOrigins(item);

      try {
        Items.prepare(item);
        assert(false, "expected failure");
      } catch (err) {
        assert.strictEqual(err.reason, DataStoreError.INVALID_ITEM);
        assert.deepEqual(err.details, {
          "title": "string.max",
          "origins": "array.max",
          "entry.username": "string.max",
          "entry.notes": "string.max"
        });
      }
    });
  });
});
