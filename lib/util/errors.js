/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Errors specific to DataStore operations.
 *
 */
class DataStoreError extends Error {
  /**
   * Creates a new DataStoreError with the given message and reason.
   *
   * @param {string} message - The error message
   * @param {Symbol} [reason=DataStoreError.GENERIC_ERROR] - The reason for the error
   */
  constructor(message, reason) {
    if ("symbol" === typeof message) {
      reason = message;
      message = "";
    }
    if (!reason) {
      reason = DataStoreError.GENERIC_ERROR;
    }
    if (!message) {
      message = /^Symbol\((.*)\)$/.exec(reason.toString())[1];
    }

    super(message);
    this.name = this.constructor.name;
    if ("function" === Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }

    /**
     * The reason for this DataStoreError.
     *
     * @member {Symbol}
     */
    this.reason = reason;
  }
}

/**
 * The datastore is not yet initialized.
 *
 * @type Symbol
 */
DataStoreError.NOT_INITIALIZED = Symbol("NOT_INITIALIZED");
/**
 * An attempt was made to initialize a datastore that is already initialized.
 *
 * @type Symbol
 */
DataStoreError.INITIALIZED = Symbol("INITIALIZED");
/**
 * When opening the local database, the actual database version does not
 * match the expected version.
 *
 * @type Symbol
 */
DataStoreError.LOCALDB_VERSION = Symbol("LOCALDB_VERSION");
/**
 * An attempt was made to use a datastore that is still locked.
 *
 * @type Symbol
 */
DataStoreError.LOCKED = Symbol("LOCKED");
/**
 * The item to be added/updated is invalid.
 *
 * @type Symbol
 */
DataStoreError.INVALID_ITEM = Symbol("INVALID_ITEM");
/**
 * An otherwise unspecified error occured with the datastore.
 *
 * @type Symbol
 */
DataStoreError.GENERIC_ERROR = Symbol("GENERIC_ERROR");

module.exports = DataStoreError;
