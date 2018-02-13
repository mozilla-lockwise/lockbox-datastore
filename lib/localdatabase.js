/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const DataStoreError = require("./util/errors"),
      constants = require("./constants");

const indexedDB = require("fake-indexeddb"),
      IDBKeyRange = require("fake-indexeddb/lib/FDBKeyRange");

const Dexie = ((module) => {
  if (module.__esModule && "default" in module) {
    return module.default;
  }
  return module;
})(require("dexie"));

// Prepare Dexie
if (Object.keys(indexedDB).length && Object.keys(IDBKeyRange).length) {
  Object.assign(Dexie.dependencies, {
    indexedDB,
    IDBKeyRange
  });
}

/**
 * Default bucket name to use for {@link localdatabase.open}.
 *
 * @memberof localdatabase
 */
const DEFAULT_BUCKET = "lockboxdatastore";
/**
 * The current (local) database version number.
 *
 * @memberof localdatabase
*/
const DATABASE_VERSION = 0.2;

let DATABASES;

const VERSIONS = {
  "0.1": (db) => (
    db.version(0.1).stores({
      items: "id,active,*origins,*tags",
      keystores: "group,uuid"
    })
  ),
  "0.2": (db) => (
    db.version(0.2).stores({
      keystores: "group,id"
    }).upgrade((tx) => {
      // upgrade keystores
      tx.keystores.toCollection().modify((ks) => {
        if (ks.group) {
          // eslint-disable-next-line no-console
          console.error(`WARNING: non-default keystore found "${ks.group}"`);
        } else {
          ks.id = constants.DEFAULT_KEYSTORE_ID;
        }
        // remove extraneous (and invalid) uuid
        delete ks.uuid;
      });
    })
  )
};

/**
 * Opens a (Dexie) Database with the given (bucket) name. This method:
 * 1. creates a new Dexie instance;
 * 2. initializes up to the latest; and
 * 3. opens the database
 *
 * @param {string} [bucket] - The name of the database.
 * @returns {Dexie} The initialized and opened Dexie database.
 * @memberof localdatabase
 */
async function open(bucket) {
  let db = new Dexie(bucket = bucket || DEFAULT_BUCKET);

  // setup versions
  // NOTE: this looks a little convoluted ...
  // .. but best helps with testing while being explicit.
  VERSIONS["0.1"](db);
  VERSIONS["0.2"](db);

  if (DATABASES) {
    DATABASES.add(db);
  }

  try {
    await db.open();
  } catch (err) {
    if (err instanceof Dexie.VersionError) {
      throw new DataStoreError(DataStoreError.LOCALDB_VERSION);
    }
    throw new DataStoreError(DataStoreError.GENERIC_ERROR, err.message);
  }
  return db;
}

/**
 * Starts up testing by remembering every Dexie database created.
 *
 * **NOTE**: This method is only for testing purposes!
 *
 * @returns {void}
 * @private
 * @memberof localdatabase
 */
async function startup() {
  DATABASES = new Set();
}
/**
 * Tears down testing by deleting all opened Dexie databases.
 *
 * **NOTE**: This method is only for testing purposes!
 *
 * @returns {void}
 * @private
 * @memberof localdatabase
 */
async function teardown() {
  if (!DATABASES) {
    return;
  }

  let all = [...DATABASES];
  all = all.map(async db => db.delete());
  await Promise.all(all);
}

Object.assign(exports, {
  open,
  teardown,
  startup,
  DEFAULT_BUCKET,
  DATABASE_VERSION,
  VERSIONS,
  Dexie
});
