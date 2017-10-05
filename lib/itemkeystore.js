/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const instance = require("./util/instance"),
      jose = require("node-jose");

/**
 * Manages a set of item keys. This includes generation, encryption, and
 * decryption of the set.
 */
class ItemKeyStore {
  /**
   * Creates a new ItemKeyStore.
   *
   * @param {Object} [self] The properties of this ItemKeyStore
   * @param {jose.JWK.Key} [self.encryptKey] The master encryption key
   * @param {String} [self.encrypted] The initial encrypted item key set to
   *                 use
   */
  constructor(self) {
    self = instance.stage(this, self);

    // prepare some required properties
    self.listing = self.listing || new Map();
  }

  /**
   * The master encryption key.
   *
   * @type {jose.JWK.Key}
   * @readonly
   */
  get encryptKey() { return instance.get(this).encryptKey || undefined; }

  /**
   * The group name.
   *
   * @type {String}
   * @readonly
   */
  get group() { return instance.get(this).group || ""; }
  /**
   * The encrypted key set, as a Compact JWE.
   *
   * @type {String}
   * @readonly
   */
  get encrypted() { return instance.get(this).encrypted || undefined; }

  /**
   * Creates a JSON representation of this ItemKeyStore.  This method returns
   * a plain Object with the following properties:
   *
   * * `group` {**String**} The name of the keystore's group
   * * `encrypted` {**Stirng**} The encrypted map of keys
   */
  toJSON() {
    return {
      group: this.group,
      encrypted: this.encrypted
    };
  }

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
    let { encryptKey, encrypted } = self;
    if (master) {
      encryptKey = master;
    }

    if (!encryptKey) {
      throw new Error("invalid master key");
    }
    if (!encrypted) {
      throw new Error("not encrypted");
    }

    let keystore = jose.JWK.createKeyStore(),
        decrypted = await jose.JWE.createDecrypt(encryptKey).decrypt(encrypted);
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
    self.encryptKey = encryptKey;

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
      encryptKey,
      listing
    } = self;

    if (!jose.JWK.isKey(encryptKey)) {
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
        alg: "dir"
      }
    };
    encrypted = await jose.JWE.createEncrypt(params, encryptKey).final(encrypted, "utf8");

    Object.assign(self, {
      encrypted
    });

    return this;
  }
  /**
   * Clears all decrypted values.  Optionally, it also clears the
   * encrypted store.
   *
   * @param {Boolean} [all=false] `true` to also delete encrypted keys
   * @return {ItemKeyStore} This ItemKeyStore
   */
  async clear(all) {
    let self = instance.get(this);

    self.listing = new Map();
    delete self.encryptKey;
    if (all) {
      delete self.encrypted;
    }

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
   * Retrieves all of the item keys.  The returned map is a snapshot of
   * the current state, and will not reflect any changes made after this
   * method is called.
   *
   * @returns {Map<String, jose.JWK.Key>} The list of item keys.
   */
  async all() {
    return new Map(instance.get(this).listing);
  }
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
  async protect(item) {
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
  async unprotect(id, jwe) {
    if (!jwe || "string" !== typeof jwe) {
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
