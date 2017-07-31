/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("chai").assert;

const instance = require("../../lib/util/instance");

describe("util/instance", () => {
  let thing1 = new Object(),
      thing2 = new Object();

  it("starts with no instance data", () => {
    assert.notExists(instance.get(thing1));
    assert.notExists(instance.get(thing2));
  });
  it("stages instance data", () => {
    let data1;
    data1 = instance.stage(thing1);
    assert.deepEqual(data1, {});
    assert.strictEqual(instance.get(thing1), data1);
    assert.strictEqual(instance.stage(thing1), data1);

    data1.name = "thing 1";
    assert.deepEqual(instance.get(thing1), { name: "thing 1" });

    assert.notExists(instance.get(thing2));
  });
  it("still has instance data", () => {
    let data1 = instance.get(thing1);
    assert.deepEqual(data1, { name: "thing 1" });
  });
});
