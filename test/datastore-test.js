/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("chai").assert;

const UUID = require("uuid"),
      DataStore = require("../lib/datastore");

// Initializing item keys database (empty)
// Created using the following:
//   secret: resin peccadillo cartage circumnavigate arithmetic reverential
//   iterations: 8192
//   salt: "htkB9-4QzaY-JEsZyBx9PA"
const PASSWORD = "resin peccadillo cartage circumnavigate arithmetic reverential";
const KEYS = "eyJhbGciOiJQQkVTMi1IUzUxMitBMjU2S1ciLCJwMmMiOjgxOTIsInAycyI6Imh0a0I5LTRRemFZLUpFc1p5Qng5UEEiLCJraWQiOiJXa3hjLUUyY0h1SDdwS244cDFDdVdKUmd1SlFiMzhSZkZKdmk3Q3VJMVg4IiwiZW5jIjoiQTEyOENCQy1IUzI1NiJ9.sanv_pn0vvCVkchsoM_Y9lRfFjn-7d_UXdUootqFtYuSF9UIIgu0PQ.cGra2P2VLal-uBbw7n3Wvg.MKukEKr6UhabZtVYMBZ_SQ.-TgzzMo8GTDj7b1Hr0-C4w";

describe("datastore", () => {
  let unlockWin = async (request) => {
    return PASSWORD;
  };

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
        keys: KEYS
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
        keys: KEYS
      };
      let ds = new DataStore(cfg);
      assert.ok(ds.initialized);
      assert.ok(ds.locked);
      assert.typeOf(ds.prompts.unlock, "function");
    });
  });

  describe("CRUD", () => {
    let main;

    before(async () => {

      main = new DataStore({
        prompts: {
          unlock: unlockWin
        },
        keys: KEYS
      });
    })

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
      let stored;
      stored = await main.list();
      assert.equal(stored.size, 0);

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
      stored = await main.list();
      assert.equal(stored.size, 1);
      assert.deepEqual(stored.get(result.id), result);

      something = JSON.parse(JSON.stringify(result));
      something.entry = Object.assign(something.entry, {
        password: "baz"
      });
      result = await main.update(something);
      assert.deepNestedInclude(result, something);
      stored = await main.list();
      assert.equal(stored.size, 1);
      assert.deepEqual(stored.get(result.id), result);

      something = result;
      result = await main.remove(something.id);
      assert.deepEqual(result, something);
      stored = await main.list();
      assert.equal(stored.size, 0);
    });
  });
});
