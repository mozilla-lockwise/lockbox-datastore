/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const INST_DATA = new WeakMap();

function get(self) { return INST_DATA.get(self); }

function stage(self) {
  let data = get(self);
  if (!data) {
    INST_DATA.set(self, data = {});
  }
  return data;
}

Object.assign(exports, {
  get,
  stage
});
