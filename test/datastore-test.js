/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("chai").assert;

const UUID = require("uuid"),
      DataStore = require("../lib/datastore");

describe("datastore", () => {
  let main;
  it("constructs an instance", () => {
    main = new DataStore();
    assert.instanceOf(main, DataStore);
    assert.ok(main.locked);
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
