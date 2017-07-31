/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("chai").assert;

const index = require("../lib"),
      DataStore = require("../lib/datastore");

describe("index", () => {
  it("creates an instance", () => {
    let data = index.create();
    assert.instanceOf(data, DataStore);
  });
});
