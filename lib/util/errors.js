/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const Messages = new Map(),
      Reasons = {};

[
  "NOT_INITIALIZED",
  "INITIALIZED",
  "LOCKED",
  "UNLOCK_ERROR",
  "SYNC_ERROR",
  "GENERIC_ERROR"
].forEach(m => {
  let s = Symbol(m);
  Reasons[m] = s;
  Messages.set(s, m);
});

class DataStoreError extends Error {
  constructor(message, reason) {
    if ("symbol" === typeof message) {
      reason = message;
      message = "";
    }
    if (!reason) {
      reason = Reasons.GENERIC_ERROR;
    }
    if (!message) {
      message = Messages.get(reason);
    }

    super(message);
    this.name = this.constructor.name;
    this.reason = reason;
    if ("function" === Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
  }
}

for (let e of Messages.entries()) {
  let [s, m] = e;
  DataStoreError[m] = s;
}

module.exports = DataStoreError;
