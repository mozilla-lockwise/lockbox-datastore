/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("chai").assert;

const DataStoreError = require("../../lib/util/errors");

describe("util/errors", () => {
  describe("Reasons", () => {
    it("checks for expected reasons", () => {
      assert.strictEqual(DataStoreError.LOCALDB_VERSION, "LOCALDB_VERSION");
      assert.strictEqual(DataStoreError.NOT_INITIALIZED, "NOT_INITIALIZED");
      assert.strictEqual(DataStoreError.INITIALIZED, "INITIALIZED");
      assert.strictEqual(DataStoreError.MISSING_APP_KEY, "MISSING_APP_KEY");
      assert.strictEqual(DataStoreError.WRONG_APP_KEY, "WRONG_APP_KEY");
      assert.strictEqual(DataStoreError.CRYPTO, "CRYPTO");
      assert.strictEqual(DataStoreError.LOCKED, "LOCKED");
      assert.strictEqual(DataStoreError.INVALID_ITEM, "INVALID_ITEM");
      assert.strictEqual(DataStoreError.MISSING_ITEM, "MISSING_ITEM");
      assert.strictEqual(DataStoreError.OFFLINE, "OFFLINE");
      assert.strictEqual(DataStoreError.AUTH, "AUTH");
      assert.strictEqual(DataStoreError.NETWORK, "NETWORK");
      assert.strictEqual(DataStoreError.GENERIC_ERROR, "GENERIC_ERROR");
    });
  });
  describe("DataStoreError", () => {
    it("creates with all arguments", () => {
      let err;
      err = new DataStoreError(DataStoreError.GENERIC_ERROR, "some generic error");
      assert.strictEqual(err.message, "GENERIC_ERROR: some generic error");
      assert.strictEqual(err.reason, DataStoreError.GENERIC_ERROR);
      assert.notEmpty(err.stack);
    });
    it("creates with missing reason", () => {
      let err;
      err = new DataStoreError("some generic error");
      assert.strictEqual(err.reason, DataStoreError.GENERIC_ERROR);
      assert.strictEqual(err.message, `${DataStoreError.GENERIC_ERROR}: some generic error`);
      assert.notEmpty(err.stack);
    });
    it("creates with missing message", () => {
      let err;
      err = new DataStoreError(DataStoreError.GENERIC_ERROR);
      assert.strictEqual(err.reason, DataStoreError.GENERIC_ERROR);
      assert.strictEqual(err.message, DataStoreError.GENERIC_ERROR);
      assert.notEmpty(err.stack);
    });
  });
});
