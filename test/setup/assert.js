/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require("chai").assert;

const ACCEPTED_DELTA_MS = 250;

function dateInRange(actual, expected, message) {
  actual = new Date(actual);
  expected = new Date(expected);
  let delta = Math.abs(actual.getTime() - expected.getTime());
  message = `${message || "date out of range"}: ${actual} vs ${expected}`;
  assert(delta < ACCEPTED_DELTA_MS, message);
}

const DATE_MEMBERS = ["created", "modified", "last_used"];
function itemMatches(actual, expected, message, parent) {
  let prefix = parent ? `${parent}: ` : "";
  if (!expected) {
    assert(actual === expected, prefix + `${message || "actual item exists"}`);
    return;
  }

  assert(actual, prefix + `${message || "actual item does not exist"}`);
  Object.keys(expected).forEach((m) => {
    let mPrefix = `${parent ? parent + "." : ""}${m}: `;
    let actVal = actual[m],
        expVal = expected[m];
    
    if (DATE_MEMBERS.indexOf(m) !== -1) {
      dateInRange(actVal, expVal, mPrefix + `${m} out of range`);
    } else if (Array.isArray(expVal)) {
      assert(Array.isArray(actVal), mPrefix + `${message || "expected actual to be an array"}`);
      assert.strictEqual(actVal.length, expVal.length, mPrefix + `${message || "array length mismatch"}`);
      for (let idx = 0; idx < expVal.length; idx++) {
        itemMatches(actVal[idx], expVal[idx], message, `${m}[${idx}]`);
      }
    } else if ("object" === typeof expVal) {
      itemMatches(actVal, expVal, message, m);
    } else {
      assert.strictEqual(actVal, expVal, mPrefix + `${message || "value mismatch"}`);
    }
  });
}

Object.assign(assert, {
  dateInRange,
  itemMatches
});
module.exports = assert;
