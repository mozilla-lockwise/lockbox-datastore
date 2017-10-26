/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = Object.assign({}, require("chai").assert, {
  reasonMatches: (actual, expected) => {
    assert.typeOf(actual, "symbol");
    assert.strictEqual(actual.toString(), `Symbol(${expected})`);
  }
});

const DataStoreError = require("../../lib/util/errors");

describe("util/errors", () => {
  describe("Reasons", () => {
    it("checks for expected reasons", () => {
      assert.reasonMatches(DataStoreError.NOT_INITIALIZED, "NOT_INITIALIZED");
      assert.reasonMatches(DataStoreError.INITIALIZED, "INITIALIZED");
      assert.reasonMatches(DataStoreError.LOCKED, "LOCKED");
      assert.reasonMatches(DataStoreError.INVALID_ITEM, "INVALID_ITEM");
      assert.reasonMatches(DataStoreError.GENERIC_ERROR, "GENERIC_ERROR");
    });
  });
  describe("DataStoreError", () => {
    it("creates with all arguments", () => {
      let err;
      err = new DataStoreError("some generic error", DataStoreError.GENERIC_ERROR);
      assert.strictEqual(err.message, "some generic error");
      assert.strictEqual(err.reason, DataStoreError.GENERIC_ERROR);
      assert.notEmpty(err.stack);
    });
    it("creates with missing reason", () => {
      let err;
      err = new DataStoreError("some other error");
      assert.strictEqual(err.message, "some other error");
      assert.strictEqual(err.reason, DataStoreError.GENERIC_ERROR);
      assert.notEmpty(err.stack);
    });
    it("creates with missing message", () => {
      let err;
      err = new DataStoreError(DataStoreError.GENERIC_ERROR);
      assert.strictEqual(err.message, "GENERIC_ERROR");
      assert.strictEqual(err.reason, DataStoreError.GENERIC_ERROR);
      assert.notEmpty(err.stack);
    });
  });
});
