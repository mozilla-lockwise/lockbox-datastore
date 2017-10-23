/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("./setup/assert"),
      UUID = require("uuid");

const Items = require("../lib/items");

const ITEM_MEMBERS = [ "id", "title", "origins", "tags", "entry", "disabled", "created", "modified", "history" ];
describe("items", () => {
  it("prepares an item with all mutables and no source", () => {
    let item = {
      title: "some title",
      origins: ["example.com"],
      tags: ["personal"],
      entry: {
        kind: "login",
        uesername: "someone",
        password: "secret",
        notes: "some notes for the entry"
      }
    };
    
    let result = Items.prepare(item);
    assert(item !== result);
    assert.hasAllKeys(result, ITEM_MEMBERS);
  });
  it("prepares an item with all mutables and a source", () => {
    let source = {
      id: UUID(),
      title: "some title",
      origins: ["example.com"],
      tags: ["personal"],
      entry: {
        kind: "login",
        username: "someone",
        password: "secret"
      },
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      disabled: false
    };
    let item = {
      title: "some title",
      origins: ["example.net"],
      tags: ["personal"],
      entry: {
        kind: "login",
        username: "someone",
        password: "another-secret",
        notes: "my personal account details"
      }
    };
    
    let result = Items.prepare(item, source);
    assert(result !== item);
    assert(result !== source);
    assert.itemMatches(result, Object.assign({history: [
      {
        created: new Date().toISOString(),
        patch: {
          password: "secret",
          notes: null
        }
      }
    ]}, source, item));
  });
});
