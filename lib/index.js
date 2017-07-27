/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const UUID = require("uuid"),
      instance = require("./util/instance");

class DataStore {
  constructor(cfg) {
    let inst = instance.stage(this);
    inst.config = Object.assign({}, cfg);
    inst.items = new Map();
  }

  get locked() {
    return !!instance.get(this).opened;
  }

  async lock() {
    // TODO: for realz
    instance.get(this).opened = false;
    return Promise.resolve(this);
  }
  async unlock() {
    // TODO: for realz
    let inst = instance.get(this);
    if (!inst.opened) {
      inst.opened = true;
    }
    return Promise.resolve(this);
  }

  async list() {
    await this.unlock();
    let inst = instance.get(this);
    let items = new Map(inst.items);
    return items;
  }

  async get(id) {
    let items = instance.get(this).items;
    let one = items.get(id);
    if (one) {
      return await this.unlock().then(() => one);
    }
    return null;
  }
  async add(item) {
    let all = instance.get(this).items;
    if (!item) {
      throw new TypeError("expected item");
    }

    // TODO: deep copy
    item = Object.assign({}, item);
    item.id = UUID();
    await this.unlock()
    all.set(item.id, item);

    return item;
  }
  async update(item) {
    let all = instance.get(this).items;
    if (!item || !item.id) {
      throw new TypeError("invalid item");
    }

    await this.unlock();
    let orig = all.get(item.id);
    if (!orig) {
      throw new Error("item does not exist");
    }
    // TODO: deep copy
    Object.assign(orig, item);
    // TODO: deep copy?
    orig = Object.assign({}, orig);

    return orig;
  }
  async remove(item) {
    let inst = instance.get(this);
    let id = (item && item.id) || item;
    return this.unlock().
           then(() => {
             inst.items.delete(id);
             return item;
           });
  }
}

function create(cfg) {
  return new DataStore(cfg);
}

Object.assign(exports, {
  create
});
