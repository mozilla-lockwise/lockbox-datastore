/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const instance = require("./util/instance"),
      jose = require("node-jose");

const DEFAULT_SALTLEN = 32,
      DEFAULT_ITERATIONS = 8192;

/**
 * Manages a set of item keys. This includes generation, encryption, and
 * decryption of the set.
 */
class ItemKeyStore {
  /**
   * Creates a new ItemKeyStore.
   *
   * @param {Object} [self] The properties of this ItemKeyStore
   * @param {jose.JWK.Key} [self.masterKey] The master encryption key
   * @param {Uint8Array} [self.salt] The initial PBKDF2 salt to use
   * @param {Number} [self.iterations=8192] The PBKDF2 iteration count to use
   * @param {String} [self.encrypted] The initial encrypted item key set to
   *                 use
   */
  constructor(self) {
    self = instance.stage(this, self);
    self.listing = new Map();
  }

  get instance() { return instance.get(this); }

  /**
   * The master encryption key.
   *
   * @type {jose.JWK.Key}
   * @readonly
   */
  get masterKey() { return instance.get(this).masterKey || undefined; }
  /**
   * The encrypted key set, as a Compact JWE.
   *
   * @type {String}
   * @readonly
   */
  get encrypted() { return instance.get(this).encrypted || undefined; }

  /**
   * Loads the item keys.  This method decrypts the stored encrypted key set
   * using the current or specified master encryption key.
   *
   * If `{master}` is provided, it overwrites the current master encryption
   * key.
   *
   * @param {jose.JWK.Key} [master] The new master encryption key to use
   * @returns {ItemKeyStore} This ItemKeyStore
   * @throws {Error} If the master encryption key is not set, or there is
   *         no encrypted key set, or encryption fails
   */
  async load(master) {
    let self = instance.get(this);
    let { masterKey, encrypted } = self;
    if (master) {
      masterKey = master;
    }

    if (!masterKey) {
      throw new Error("invalid master key");
    }
    if (!encrypted) {
      throw new Error("not encrypted");
    }

    let keystore = jose.JWK.createKeyStore(),
        decrypted = await jose.JWE.createDecrypt(masterKey).decrypt(encrypted);
    decrypted = decrypted.payload.toString("utf8");
    decrypted = JSON.parse(decrypted);
    decrypted = await Promise.all(Object.entries(decrypted).map(async (e) => {
      let [id, key] = e;
      key = await keystore.add(key);
      return [id, key];
    }));

    let listing = self.listing = new Map();
    decrypted.forEach(entry => {
      let [id, key] = entry;
      listing.set(id, key);
    });
    self.masterKey = masterKey;

    return this;
  }
  /**
   * Saves the item keys.  This method serializes the item keys into and
   * encrypts them using the current master encryption key.
   *
   * Once this method completes, `{encrypted}` is set to the newly encrypted
   * key set.
   *
   * @returns {ItemKeyStore} This ItemKeyStore
   * @throws {Error} If the master encryption key is invalid, or encryption
   *         fails
   */
  async save() {
    let self = instance.get(this);
    let {
      masterKey,
      salt = jose.util.randomBytes(DEFAULT_SALTLEN),
      iterations = DEFAULT_ITERATIONS,
      listing
    } = self;

    if (!jose.JWK.isKey(masterKey)) {
      throw new Error("invalid master key");
    }

    let encrypted = {};
    for (let entry of listing.entries()) {
      let [id, key] = entry;
      encrypted[id] = key.toJSON(true);
    }
    encrypted = JSON.stringify(encrypted);

    let params = {
      format: "compact",
      contentAlg: "A256GCM",
      fields: {
        p2c: iterations,
        p2s: jose.util.base64url.encode(salt)
      }
    };
    encrypted = await jose.JWE.createEncrypt(params, masterKey).final(encrypted, "utf8");

    // calculate next salt
    salt = jose.JWA.digest("SHA-256", salt);

    Object.assign(self, {
      salt,
      iterations,
      encrypted
    });

    return this;
  }
  /**
   * Clears all decrypted values.
   *
   * @return {ItemKeyStore} This ItemKeyStore
   */
  async clear() {
    let self = instance.get(this);

    self.listing = new Map();
    delete self.masterKey;

    return this;
  }

  /**
   * The number of item keys available (not encrypted).
   *
   * @type {Number}
   * @readonly
   */
  get size() { return instance.get(this).listing.size; }
  /**
   * Retrieves an item key for the given id.
   *
   * @param {String} id The item key identifier
   * @returns {jose.JWK.Key} The item key, or `undefined` if not known
   */
  async get(id) {
    return instance.get(this).listing.get(id);
  }
  /**
   * Adds an item key for the given id.  If a key for `{id}` is already
   * known, it is returned instead of generating a new one.
   *
   * @param {String} id The item key identifier
   * @returns {jose.JWK.Key} The new or existing item key
   */
  async add(id) {
    let key = await this.get(id);
    if (!key) {
      key = await jose.JWK.createKeyStore().generate("oct", 256, {
        alg: "A256GCM",
        kid: id
      });
      instance.get(this).listing.set(id, key);
    }
    return key;
  }
  /**
   * Removes the item key for the given id.
   *
   * @param {Stirng} id The item key identifier
   */
  async delete(id) {
    let listing = instance.get(this).listing;
    delete listing.delete(id);
  }

  /**
   * Encrypts an item.
   *
   * The `{item}` is expected to have a string `id` property, which is
   * used to match it its key.  If a key for the item's id does not exist,
   * it is first created.
   *
   * @param {Object} item The item to encrypt
   * @returns {String} The encrypted item as a compact JWE
   * @throws {Error} if `{item}` is invalid, or if encryption failed
   */
  async encrypt(item) {
    if (!item || !item.id) {
      throw new Error("invalid item");
    }

    let { id } = item;
    let key = await this.add(id);

    item = JSON.stringify(item);
    let jwe = jose.JWE.createEncrypt({ format: "compact" }, key);
    jwe = await jwe.final(item, "utf8");

    return jwe;
  }
  /**
   * Decrypts an item.
   *
   * @param {String} id The item id
   * @param {String} jwe The encrypted item as a compact JWE
   * @returns {Object} The decrypted item
   * @throws {Error} if `{id}` or `{jwe}` is invalid, or if dencryption failed
   */
  async decrypt(id, jwe) {
    if (!jwe) {
      throw new Error("invalid encrypted item");
    }

    let key = await this.get(id);
    if (!key) {
      throw new Error("unknown item key");
    }

    let item = await jose.JWE.createDecrypt(key).decrypt(jwe);
    item = item.payload.toString("utf8");
    item = JSON.parse(item);

    return item;
  }
}

module.exports = ItemKeyStore;
