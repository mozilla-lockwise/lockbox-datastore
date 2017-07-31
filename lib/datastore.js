/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const UUID = require("uuid"),
      instance = require("./util/instance");

/**
 * Represents item storage.
 */
class DataStore {
  /**
   * Creates a new DataStore.
   *
   * @param {Onject} cfg - The configuration parameters
   */
  constructor(cfg) {
    let inst = instance.stage(this);
    inst.config = Object.assign({}, cfg);
    inst.items = new Map();
    inst.locked = true;
  }

  /**
   * Indicates if this datastore is locked or unlocked.
   *
   * @type Boolean
   */
  get locked() {
    return !!instance.get(this).locked;
  }
  /**
   * Locks this datastore.
   *
   * @returns {DataStore} This DataStore once locked
   */
  async lock() {
    // TODO: for realz
    instance.get(this).locked = true;
    return Promise.resolve(this);
  }
  /**
   * Attempts to unlock this datastore.
   *
   * @returns {DataStore} This DataStore once unlocked
   */
  async unlock() {
    // TODO: for realz
    let self = instance.get(this);
    if (self.locked) {
      self.locked = false;
    }
    return Promise.resolve(this);
  }

  /**
   * Retriieves all of the items stored in this DataStore.
   *
   * @returns {Map<String, Object>} The map of stored item, by id
   */
  async list() {
    await this.unlock();
    let inst = instance.get(this);
    let items = new Map(inst.items);
    return items;
  }

  /**
   * Retrieves a single item from this DataStore
   *
   * @param {String} id The item id to retrieve
   * @returns {Object} The JSON representing the item, or `null` if there is
   *          no item for `{id}`
   */
  async get(id) {
    let items = instance.get(this).items;
    let one = items.get(id);
    if (one) {
      await this.unlock();
      return one;
    }
    return null;
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
    let all = instance.get(this).items;
    if (!item) {
      // TODO: custom errors
      throw new TypeError("expected item");
    }

    // TODO: check for existing item?
    // TODO: deep copy
    item = Object.assign({}, item);
    item.id = UUID();
    await this.unlock()
    all.set(item.id, item);
    // TODO: better deep copy
    item = JSON.parse(JSON.stringify(item));

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
    let all = instance.get(this).items;
    if (!item || !item.id) {
      // TODO: custom errors
      throw new TypeError("invalid item");
    }

    await this.unlock();
    let orig = all.get(item.id);
    if (!orig) {
      throw new Error("item does not exist");
    }

    // TODO: better deep copy?
    // TODO: separate out immutable fields (history, created, etc)
    item = JSON.parse(JSON.stringify(item));

    // TODO: generate patches
    Object.assign(orig, item);

    // TODO: better deep copy?
    orig = JSON.parse(JSON.stringify(orig));

    return orig;
  }
  /**
   * Removes an item from this DataStore.
   *
   * @param {String} id - The item id to remove
   * @returns {Object} The removed item, or `null` if no item was removed
   */
  async remove(id) {
    let inst = instance.get(this);
    await this.unlock();

    let item = inst.items.get(id);
    inst.items.delete(id);
    return item || null;
  }
}

module.exports = DataStore;
