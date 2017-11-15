/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const DataStoreError = require("./util/errors");

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
 * Defines the local (IndexedDB) database, using Dexie.
 *
 * @module localdatabase
 * @private
 */

/**
 * Default bucket name to use for {@link localdatabase.open}.
 *
 * @memberof localdatabase
 */
const DEFAULT_BUCKET = "lockbox";
const DATABASE_VERSION = 0.1;

let DATABASES;

/**
 * Opens a (Dexie) Database with the given (bucket) name. This method:
 * 1. creates a new Dexie instance;
 * 2. initializes up to the latest; and
 * 3. opens the database
 *
 * @param {String} [bucket] - The name of the database.
 * @returns {Dexie} The initialized and opened Dexie database.
 * @memberof localdatabase
 */
async function open(bucket) {
  let db = new Dexie(bucket = bucket || DEFAULT_BUCKET);

  // setup version 0.1
  db.version(0.1).stores({
    items: "id,active,*origins,*tags",
    keystores: "group,uuid"
  });
  if (DATABASES) {
    DATABASES.add(db);
  }

  await db.open();
  if (db.verno !== DATABASE_VERSION) {
    throw new DataStoreError("invalid indexeddb version", DataStoreError.LOCALDB_VERSION);
  }
  return db;
}

/**
 * Starts up testing by remembering every Dexie database created.
 *
 * **NOTE**: This method is only for testing purposes!
 *
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
  DATABASE_VERSION
});
