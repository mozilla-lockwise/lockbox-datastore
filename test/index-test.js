/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("chai").assert;

const ds = require("../lib");

describe("datastore", () => {
  it("creates an instance", () => {
    let data = ds.create();
    assert.exists(data);
  });
});
