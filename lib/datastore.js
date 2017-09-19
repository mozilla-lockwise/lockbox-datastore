/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const UUID = require("uuid"),
      ItemKeyStore = require("./itemkeystore"),
      errors = require("./util/errors"),
      instance = require("./util/instance"),
      localdatabase = require("./localdatabase"),
      jose = require("node-jose");

// BASE64URL(SHA-256("project lockbox"))
const PASSWORD_PREFIX = "-GV3ItzyNxfBGp3ZjtqVGswWWlT7tIMZjeXanHqhxm0";

const DEFAULT_PROMPTS = {
  unlock: async (request) => {
    if (1 < request.attempts) {
      throw new errors.DataStoreError("too many attempts", errors.Reasons.GENERIC_ERROR);
    }
    return "";
  }
};

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
    self.prompts = Object.assign({}, DEFAULT_PROMPTS, cfg.prompts);

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
   * The prompt handling functions configured in this DataStore.
   *
   * The `{unlock}` handler function is expected to match the
   * following:
   *
   * ```
   * async function(request) {
   *    // {request} is an Object containing the following members:
   *    request.error;    // an Error describing a previous failure, if any
   *    request.attempts; // the Number of attempts so far (including this one)
   *    // returns a Promise containing the unlock secret (as a string)
   * }
   * ```
   *
   * @type {Object}
   * @property {Function} unlock The prompt function called to handle {unlock}.
   */
  get prompts() { return Object.assign({}, instance.get(this).prompts); }
  set prompts(p) {
    let self = instance.get(this);
    self.prompts = Object.assign({}, DEFAULT_PROMPTS, p || {});
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
      throw new errors.DataStoreError("already initialized", errors.Reasons.GENERIC_ERROR);
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
   * @returns {DataStore} This DataStore once unlocked
   */
  async unlock() {
    let self = instance.get(this);
    let { keystore, prompts } = self;
    let masterKey, error, attempts = 0;

    // TODO: set a max attempts limit?
    while (!keystore.masterKey) {
      // prompt for the password
      try {
        attempts++;

        // prompt for the password
        let req = {
          error,
          attempts
        };
        let pwd;
        pwd = await prompts.unlock(req);
        // try to decrypt item keys
        // TODO: replace with something based on WebCrypto API
        masterKey = await passwordToKey(pwd);
        await keystore.load(masterKey);
      } catch (err) {
        masterKey = null;
        if (errors.Reasons.ABORTED !== err.reason) {
          throw err;
        }
        // try it again
        // TODO: reformat errors to something more understandable?
        error = err;
      }
    }

    return this;
  }

  /**
   * Retrieves all of the items stored in this DataStore.
   *
   * @returns {Map<String, Object>} The map of stored item, by id
   */
  async list() {
    await this.unlock();
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
    await this.unlock();
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

    await this.unlock();
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
    let self = instance.get(this);

    if (!item || !item.id) {
      // TODO: custom errors
      throw new TypeError("invalid item");
    }

    await this.unlock();
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
    let self = instance.get(this);
    await this.unlock();

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
