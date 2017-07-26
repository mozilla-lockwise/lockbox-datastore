/*!
 *
 */

const assert = require("chai").assert;

const ds = require("../lib");

describe("datastore", () => {
  it("creates an instance", () => {
    let data = ds.create();
    assert.exists(data);
  });
});
