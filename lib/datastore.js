/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const UUID = require("uuid"),
      ItemKeyStore = require("./itemkeystore"),
      DataStoreError = require("./util/errors"),
      instance = require("./util/instance"),
      localdatabase = require("./localdatabase"),
      jose = require("node-jose");

// BASE64URL(SHA-256("project lockbox"))
const PASSWORD_PREFIX = "-GV3ItzyNxfBGp3ZjtqVGswWWlT7tIMZjeXanHqhxm0";

function checkState(ds) {
  if (!ds.initialized) {
    throw new DataStoreError("data is not initialized", DataStoreError.NOT_INITIALIZED);
  }
  if (ds.locked) {
    throw new DataStoreError("datastore is locked", DataStoreError.LOCKED);
  }
}

async function passwordToKey(pwd) {
  pwd = PASSWORD_PREFIX + pwd;

  let key = {
    kty: "oct",
    k: jose.util.base64url.encode(pwd, "utf8"),
    use: "enc"
  };
  key = await jose.JWK.asKey(key);

  return key;
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
   * @param {Onject} cfg - The configuration parameters
   */
  constructor(cfg) {
    cfg = cfg || {};

    let self = instance.stage(this);
    self.items = new Map();

    self.bucket = cfg.bucket;

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
      let keystore = await ldb.keystores.get("");
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
   * @type {Boolean}
   * @readonly
   */
  get initialized() { return !!(instance.get(this).keystore.encrypted); }

  /**
   * Initializes this DataStore with the given options. This method
   * creates an empty item keystore, and encrypts it using the password
   * specified in `{opts}`.
   *
   * If no `{salt}` is provided, a randomly generated 16-byte value is used.
   *
   * @param {Object} opts The initialization options
   * @param {String} [opts.password=""] The master password to lock with
   * @param {String} [opts.salt] The salt to use in deriving the master
   *        key.
   * @param {Number} [opts.iterations=8192] The iteration count to use in
   *        deriving the master key
   */
  async initialize(opts) {
    // TODO: remove this when everthing is prepared
    await this.prepare();

    opts = opts || {};
    let self = instance.get(this);

    // TODO: deal with (soft / hard) reset
    if (self.keystore.encrypted) {
      // TODO: specific error reason?
      throw new DataStoreError("already initialized", DataStoreError.INITIALIZED);
    }

    opts = opts || {};
    let { password, salt, iterations } = opts || {};
    let masterKey = await passwordToKey(password || "");
    let keystore = new ItemKeyStore({
      salt,
      iterations,
      masterKey
    });
    self.keystore = await keystore.save();
    await self.ldb.keystores.put(self.keystore.toJSON());

    return this;
  }

  /**
   * Indicates if this datastore is locked or unlocked.
   *
   * @type {Boolean}
   * @readonly
   */
  get locked() {
    return !(instance.get(this).keystore.masterKey);
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
   * @param {String} pwd The password to unlock the datastore.
   * @returns {DataStore} This DataStore once unlocked
   */
  async unlock(pwd) {
    let self = instance.get(this);
    let { keystore } = self;
    let masterKey;

    if (!this.locked) {
      // fast win
      return this;
    }

    try {
      masterKey = await passwordToKey(pwd);
      await keystore.load(masterKey);
    } catch (err) {
      // TODO: differentiate errors?
      throw err;
    }

    return this;
  }

  /**
   * Retrieves all of the items stored in this DataStore.
   *
   * @returns {Map<String, Object>} The map of stored item, by id
   */
  async list() {
    checkState(this);

    let self = instance.get(this);
    let all;
    all = await self.ldb.items.toArray();
    all = all.map(async i => {
      let { id, encrypted } = i;
      let item = await self.keystore.decrypt(id, encrypted);
      return [ id, item ];
    });
    all = await Promise.all(all);

    let result = new Map(all);

    return result;
  }

  /**
   * Retrieves a single item from this DataStore
   *
   * @param {String} id The item id to retrieve
   * @returns {Object} The JSON representing the item, or `null` if there is
   *          no item for `{id}`
   */
  async get(id) {
    checkState(this);

    let self = instance.get(this);
    let one = await self.ldb.items.get(id);
    if (one) {
      one = one.encrypted;
      one = await self.keystore.decrypt(id, one);
    }
    return one || null;
  }
  /**
   * Adds a new item to this DataStore.
   *
   * The `{id}` of the item is replaced with a new UUID.
   *
   * @param {Object} item - The item to add
   * @returns {Object} The added item, with all fields completed
   * @throws {TypeError} if `item` is invalid
   */
  async add(item) {
    checkState(this);

    let self = instance.get(this);
    if (!item) {
      // TODO: custom errors
      throw new TypeError("expected item");
    }

    // TODO: check for existing item?
    // TODO: deep copy
    let id = UUID(),
        now = new Date();

    item = Object.assign({}, item);
    item.id = id;
    item.created = item.created || now;
    item.modified = item.modified || now;

    let active = !item.disabled ? "active" : "",
        encrypted = await self.keystore.encrypt(item);

    item = {
      id,
      active,
      encrypted
    };
    let ldb = self.ldb;
    await self.keystore.save();
    await ldb.transaction("rw", ldb.items, ldb.keystores, () => {
      ldb.items.add(item);
      ldb.keystores.put(self.keystore.toJSON());
    });
    // TODO: find a more efficient way to get a cleaned item
    item = await self.keystore.decrypt(id, encrypted);

    return item;
  }
  /**
   * Updates an existing item in this DataStore.
   *
   * @param {Object} item - The item to update
   * @returns {Object} The updated item
   * @throws {Error} if this item does not exist
   * @throws {TypeError} if `item` is invalid
   */
  async update(item) {
    checkState(this);

    let self = instance.get(this);
    if (!item || !item.id) {
      // TODO: custom errors
      throw new TypeError("invalid item");
    }

    let id = item.id;
    let orig = await self.ldb.items.get(id),
        encrypted;
    if (!orig) {
      throw new Error("item does not exist");
    } else {
      encrypted = orig.encrypted;
    }

    // TODO: better deep copy?
    // TODO: separate out immutable fields (history, created, etc)
    item = JSON.parse(JSON.stringify(item));

    // TODO: generate patches
    orig = await self.keystore.decrypt(id, encrypted);
    Object.assign(orig, item);
    orig.modified = new Date();

    // TODO: find a more efficient way to get a cleaned item
    item = JSON.parse(JSON.stringify(orig));

    let active = !orig.disabled ? "active" : "";
    encrypted = await self.keystore.encrypt(orig);

    orig = {
      id,
      active,
      encrypted
    };
    await self.ldb.items.put(orig);

    return item;
  }
  /**
   * Removes an item from this DataStore.
   *
   * @param {String} id - The item id to remove
   * @returns {Object} The removed item, or `null` if no item was removed
   */
  async remove(id) {
    checkState(this);

    let self = instance.get(this);
    let item = await self.ldb.items.get(id);
    if (item) {
      item = await self.keystore.decrypt(id, item.encrypted);
      self.keystore.delete(id);

      let ldb = self.ldb;
      await self.keystore.save();
      await ldb.transaction("rw", ldb.items, ldb.keystores, () => {
        ldb.items.delete(id);
        ldb.keystores.put(self.keystore.toJSON());
      });
    }

    return item || null;
  }
}

module.exports = DataStore;
