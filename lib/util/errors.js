/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const REASONS = [
  "LOCALDB_VERSION",
  "NOT_INITIALIZED",
  "INITIALIZED",
  "MISSING_APP_KEY",
  "WRONG_APP_KEY",
  "LOCKED",
  "INVALID_ITEM",
  "MISSING_ITEM",
  "CRYPTO",
  "OFFLINE",
  "AUTH",
  "NETWORK",
  "SYNC_LOCKED",
  "GENERIC_ERROR"
];

/**
 * Errors specific to DataStore operations.
 *
 */
class DataStoreError extends Error {
  /**
   * @constructs
   * Creates a new DataStoreError with the given message and reason.
   *
   * @param {string} [reason=DataStoreError.GENERIC_ERROR] - The reason for the error
   * @param {string} [message] - The error message
   */
  constructor(reason, message) {
    if (-1 === REASONS.indexOf(reason)) {
      message = reason;
      reason = null;
    }
    if (!reason) {
      reason = DataStoreError.GENERIC_ERROR;
    }
    if (!message) {
      message = reason;
    } else {
      message = `${reason}: ${message}`;
    }

    super(message);
    this.name = this.constructor.name;
    if ("function" === Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }

    /**
     * The reason name for this DataStoreError.
     *
     * @member {string}
     */
    this.reason = reason;
  }
}

REASONS.forEach((r) => DataStoreError[r] = r);

/**
 * When opening a local database, the actual database version does not match the expected version.
 * @member {string} DataStoreError.LOCALDB_VERSION
 */
/**
 * The datastore is not yet initialized.
 * @member {string} DataStoreError.NOT_INITIALIZED
 */
/**
 * An attempt was made to initialize a datastore that is already initialized.
 * @member {string} DataStoreError.INITIALIZED
 */
/**
 * No master key was provided.
 * @member {string} DataStoreError.MISSING_APP_KEY
 */
/**
 * The master key is not valid for the encrypted data.
 * @member {string} DataStoreError.WRONG_APP_KEY
 */
/**
 * An attempt was made to use a datastore that is still locked.
 * @member {string} DataStoreError.LOCKED
 */
/**
 * The item to be added/updated is invalid.
 * @member {string} DataStoreError.INVALID_ITEM
 */
/**
 * The item to be updated does not exist.
 * @member {string} DataStoreError.MISSING_ITEM
 */
/**
 * There was a cryptographic error.
 * @member {string} DataStoreError.CRYPTO
 */
/**
 * An operation requires network connectivety, but there is none.
 * @member {string} DataStoreError.OFFLINE
 */
/**
 * An operation requires (remote) authentication before it can be performed.
 * @member {string} DataStoreError.AUTH
 */
/**
 * An operation encountered a (generic) network error.
 * @member {string} DataStoreError.NETWORK
 */
/**
 * An attempt was made to sync a datastore, but cannot be completed until unlocked.
 * @member {string} DataStoreError.SYNC_LOCKED
 */
/**
 * An otherwise unspecified error occurred with the datastore.
 * @member {string} DataStoreError.GENERIC_ERROR
 */

module.exports = DataStoreError;
