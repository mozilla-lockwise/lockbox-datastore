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

const errors = require("../../lib/util/errors");

describe("util/errors", () => {
  describe("Reasons", () => {
    it("checks for expected reasons", () => {
      let { Reasons } = errors;
      assert.reasonMatches(Reasons.ABORTED, "ABORTED");
      assert.reasonMatches(Reasons.SYNC_ERROR, "SYNC_ERROR");
      assert.reasonMatches(Reasons.UNLOCK_ERROR, "UNLOCK_ERROR");
      assert.reasonMatches(Reasons.GENERIC_ERROR, "GENERIC_ERROR");
    });
  });
  describe("DataStoreError", () => {
    let { Reasons, DataStoreError } = errors;
    it("creates with all arguments", () => {
      let err;
      err = new DataStoreError("some generic error", Reasons.GENERIC_ERROR);
      assert.strictEqual(err.message, "some generic error");
      assert.strictEqual(err.reason, Reasons.GENERIC_ERROR);
      assert.notEmpty(err.stack);
    });
    it("creates with missing reason", () => {
      let err;
      err = new DataStoreError("some other error");
      assert.strictEqual(err.message, "some other error");
      assert.strictEqual(err.reason, Reasons.GENERIC_ERROR);
      assert.notEmpty(err.stack);
    });
    it("creates with missing message", () => {
      let err;
      err = new DataStoreError(Reasons.GENERIC_ERROR);
      assert.strictEqual(err.message, "GENERIC_ERROR");
      assert.strictEqual(err.reason, Reasons.GENERIC_ERROR);
      assert.notEmpty(err.stack);
    });
  });
});
