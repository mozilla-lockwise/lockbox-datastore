/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const Items = require("./items"),
      ItemKeyStore = require("./itemkeystore"),
      DataStoreError = require("./util/errors"),
      constants = require("./constants"),
      instance = require("./util/instance"),
      localdatabase = require("./localdatabase"),
      jose = require("node-jose");

// SHA-256("lockbox encrypt")
const HKDF_INFO_ENCRYPT = "9UUucG8PDHPGXwM-pGoT0-aFGu74M54k55AykEgOx98";
// SHA-256("lockbox hashing")
const HKDF_INFO_HASHING = "pz8gGLGYNLV6haKwjJ1dR-YKX5zDMhPHw2DuXGNu6cw";

async function deriveKeys(appKey, salt) {
  if (!appKey) {
    throw new DataStoreError(DataStoreError.MISSING_APP_KEY);
  }
  appKey = await jose.JWK.asKey(appKey);

  salt = Buffer.from(salt || "");

  let keyval = appKey.get("k", true);
  let encryptKey = await jose.JWA.derive("HKDF-SHA-256", keyval, {
    salt,
    info: jose.util.base64url.decode(HKDF_INFO_ENCRYPT)
  });
  encryptKey = await jose.JWK.asKey({
    kty: "oct",
    alg: "A256GCM",
    k: encryptKey
  });

  let hashingKey = await jose.JWA.derive("HKDF-SHA-256", keyval, {
    salt,
    info: jose.util.base64url.decode(HKDF_INFO_HASHING)
  });
  hashingKey = await jose.JWK.asKey({
    kty: "oct",
    alg: "HS256",
    k: hashingKey
  });

  return {
    encryptKey,
    hashingKey,
    salt
  };
}

function checkState(ds, unlocking) {
  if (!ds.initialized) {
    throw new DataStoreError(DataStoreError.NOT_INITIALIZED);
  }
  if (!unlocking && ds.locked) {
    throw new DataStoreError(DataStoreError.LOCKED);
  }
}

function determineItemChanges(prev, next) {
  // TODO: calculate JSON-merge diff

  prev = prev || {};
  next = next || {};
  next = Object.assign({}, prev, next);

  let fields = [];
  // check title
  if (prev.title !== next.title) {
    fields.push("title");
  }
  // check previns
  let prevOrigins = [...(prev.origins || [])];
  let nextOrigins = [...(next.origins || [])];
  if (prevOrigins.length !== nextOrigins.length || !prevOrigins.every((d) => nextOrigins.indexOf(d) !== -1)) {
    fields.push("origins");
  }

  // check entries.(username,password,notes)
  let prevEntry = prev.entry || {};
  let nextEntry = next.entry || {};
  ["username", "password", "notes"].forEach((f) => {
    if (prevEntry[f] !== nextEntry[f]) {
      fields.push(`entry.${f}`);
    }
  });
  fields = fields.join(",");

  return {
    fields
  };
}

/**
 * Represents item storage.
 */
class DataStore {
  /**
   * Creates a new DataStore.
   *
   * **NOTE:** This constructor is not called directly.  Instead call
   * {@link open} to obtain a [prepared]{@link DataStore#prepare} instance.
   *
   * See {@link datastore.create} for the details of what `{cfg}`
   * parameters are supported.
   *
   * @param {Object} cfg The configuration parameters.
   * @constructor
   */
  constructor(cfg) {
    cfg = cfg || {};

    let self = instance.stage(this);
    self.items = new Map();

    self.bucket = cfg.bucket;
    self.salt = cfg.salt || "";
    self.recordMetric = cfg.recordMetric || (async () => {});

    // TESTING ONLY: accept an (encrypted) item keys map
    self.keystore = new ItemKeyStore({
      encrypted: cfg.keys
    });
  }

  /**
   * Prepares this DataStore. This method:
   *
   * 1. initializes and opens the local database; and
   * 2. loads any stored keys from the local database.
   *
   * If the database is already prepared, this method does nothing.
   *
   * @returns {DataStore} This DataStore.
   */
  async prepare() {
    let self = instance.get(this);

    let ldb = self.ldb;
    if (!ldb) {
      ldb = await localdatabase.open(self.bucket);
      let keystore = await ldb.keystores.get(constants.DEFAULT_KEYSTORE_GROUP);
      if (!keystore) {
        keystore = self.keystore.toJSON();
      }

      keystore = new ItemKeyStore(keystore);
      Object.assign(self, {
        ldb,
        keystore
      });
    }

    return this;
  }

  /**
   * Indicates whether this DataStore is initialized.
   *
   * @type {boolean}
   * @readonly
   */
  get initialized() {
    return !!(instance.get(this).keystore.encrypted);
  }

  /**
   * Initializes this DataStore with the given options. This method
   * creates an empty item keystore, and encrypts it using the password
   * specified in `{opts}`.
   *
   * **NOTE:** If {salt} is provided here, it overrides and replaces any
   * previously set salt, including from {DataStore.open}.
   *
   * @param {Object} opts The initialization options
   * @param {jose.JWK.Key} [opts.appKey] The master app key to setup with
   * @param {string} [opts.salt] The salt to use in deriving the master
   *        keys
   * @param {boolean} [opts.rebase=false] Rebase an already initialized
   *        DataStore to use a new password
   * @returns {DataStore} This datastore
   */
  async initialize(opts) {
    // TODO: remove this when everything is prepared
    await this.prepare();

    opts = opts || {};
    let self = instance.get(this);

    // TODO: deal with soft reset
    let listing = undefined;
    if (self.keystore.encrypted) {
      if (!opts.rebase) {
        throw new DataStoreError(DataStoreError.INITIALIZED);
      } else if (opts.rebase && this.locked) {
        throw new DataStoreError(DataStoreError.LOCKED, "must be unlocked in order to rebase");
      }

      // migrate it out
      listing = await self.keystore.all();
    }

    opts = opts || {};
    let appKey = opts.appKey,
        salt = self.salt;
    if ("salt" in opts) {
      // if salt is present in any form, replace it
      salt = opts.salt;
    }
    let { encryptKey, hashingKey } = await deriveKeys(appKey, salt);
    let keystore = new ItemKeyStore({
      encryptKey,
      hashingKey,
      listing
    });
    self.keystore = await keystore.save();
    self.salt = salt;
    await self.ldb.keystores.put(self.keystore.toJSON());

    return this;
  }
  /**
   * Resets this Datastore. This method deletes all items and keys stored.
   * This is not a recoverable action.
   *
   * @returns {DataStore} This datastore instance
   */
  async reset() {
    if (this.initialized) {
      let self = instance.get(this);
      await self.ldb.delete();
      self.keystore.clear(true);
      delete self.ldb;
    }

    return this;
  }

  /**
   * Indicates if this datastore is locked or unlocked.
   *
   * @type {boolean}
   * @readonly
   */
  get locked() {
    return !(instance.get(this).keystore.encryptKey);
  }
  /**
   * Locks this datastore.
   *
   * @returns {DataStore} This DataStore once locked
   */
  async lock() {
    let self = instance.get(this);

    await self.keystore.clear();

    return this;
  }
  /**
   * Attempts to unlock this datastore.
   *
   * @param {jose.JWK.Key} appKey The application key to unlock the datastore
   * @returns {DataStore} This DataStore once unlocked
   */
  async unlock(appKey) {
    checkState(this, true);

    let self = instance.get(this);
    let { keystore } = self;

    if (!this.locked) {
      // fast win
      return this;
    }

    try {
      let { encryptKey } = await deriveKeys(appKey, self.salt);
      await keystore.load(encryptKey);
    } catch (err) {
      // TODO: differentiate errors?
      throw err;
    }

    return this;
  }

  /**
   * Retrieves all of the items stored in this DataStore.
   *
   * @returns {Map<string, Object>} The map of stored item, by id
   */
  async list() {
    checkState(this);

    let self = instance.get(this);
    let all;
    all = await self.ldb.items.toArray();
    all = all.map(async i => {
      let { id, encrypted } = i;
      let item = await self.keystore.unprotect(id, encrypted);
      return [ id, item ];
    });
    all = await Promise.all(all);

    let result = new Map(all);

    return result;
  }

  /**
   * Retrieves a single item from this DataStore
   *
   * @param {string} id The item id to retrieve
   * @returns {Object} The JSON representing the item, or `null` if there is
   *          no item for `{id}`
   */
  async get(id) {
    checkState(this);

    let self = instance.get(this);
    let one = await self.ldb.items.get(id);
    if (one) {
      one = one.encrypted;
      one = await self.keystore.unprotect(id, one);
    }
    return one || null;
  }
  /**
   * Adds a new item to this DataStore.
   *
   * The `{id}` of the item is replaced with a new UUID.
   *
   * @param {Object} item The item to add
   * @returns {Object} The added item, with all fields completed
   * @throws {TypeError} if `item` is invalid
   */
  async add(item) {
    checkState(this);

    let self = instance.get(this);
    if (!item) {
      throw new DataStoreError(DataStoreError.INVALID_ITEM);
    }

    // validate, and fill defaults into, {item}
    item = Items.prepare(item);

    let id = item.id,
        active = !item.disabled ? "active" : "",
        encrypted = await self.keystore.protect(item);

    let record = {
      id,
      active,
      encrypted
    };
    let ldb = self.ldb;
    await self.keystore.save();
    await ldb.transaction("rw", ldb.items, ldb.keystores, () => {
      ldb.items.add(record);
      ldb.keystores.put(self.keystore.toJSON());
    });
    self.recordMetric("added", item.id);

    return item;
  }
  /**
   * Updates an existing item in this DataStore.
   *
   * `{item}` is expected to be a complete object; any (mutable) fields missing
   * are removed from the stored value.  API users should call {@link #get},
   * then make the desired changes to the returned value.
   *
   * @param {Object} item The item to update
   * @returns {Object} The updated item
   * @throws {Error} if this item does not exist
   * @throws {TypeError} if `item` is not an object with a `id` member
   * @throws {DataStoreError} if the `item` violates the schema
   */
  async update(item) {
    checkState(this);

    let self = instance.get(this);
    if (!item || !item.id) {
      // TODO: custom errors
      throw new DataStoreError(DataStoreError.INVALID_ITEM);
    }

    let id = item.id;
    let orig = await self.ldb.items.get(id),
        encrypted;
    if (!orig) {
      throw new DataStoreError(DataStoreError.MISSING_ITEM);
    } else {
      encrypted = orig.encrypted;
    }

    orig = await self.keystore.unprotect(id, encrypted);
    item = Items.prepare(item, orig);

    let changes = determineItemChanges(orig, item);

    let active = !item.disabled ? "active" : "";
    encrypted = await self.keystore.protect(item);

    let record = {
      id,
      active,
      encrypted
    };
    await self.ldb.items.put(record);
    self.recordMetric("updated", item.id, changes.fields);

    return item;
  }
  /**
   * Removes an item from this DataStore.
   *
   * @param {string} id The item id to remove
   * @returns {Object} The removed item, or `null` if no item was removed
   */
  async remove(id) {
    checkState(this);

    let self = instance.get(this);
    let item = await self.ldb.items.get(id);
    if (item) {
      item = await self.keystore.unprotect(id, item.encrypted);
      self.keystore.delete(id);

      let ldb = self.ldb;
      await self.keystore.save();
      await ldb.transaction("rw", ldb.items, ldb.keystores, () => {
        ldb.items.delete(id);
        ldb.keystores.put(self.keystore.toJSON());
      });
      self.recordMetric("deleted", item.id);
    }

    return item || null;
  }
}

module.exports = DataStore;
