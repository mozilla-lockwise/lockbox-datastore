#! /usr/bin/env node
/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const jose = require("node-jose"),
      fs = require("promisified-fs"),
      yargs = require("yargs"),
      PASSWORD = require("password"),
      UUID = require("uuid");

var argv = yargs.
          option("secret", {
            desc: "the secret passphrase to use",
            default: "resin peccadillo cartage circumnavigate arithmetic reverential",
            requiresArg: true
          }).
          option("random", {
            desc: "if a random passphrase should be generated (ignores --secret)",
            boolean: true
          }).
          option("output", {
            desc: "the file to write the results to",
            required: true,
            requiresArg: true
          }).
          help().
          argv;

async function main() {
  let { random, secret, output } = argv;
  if (random) {
    secret = PASSWORD(4);
  }

  let master = await jose.JWK.asKey({
    kty: "oct",
    k: jose.util.base64url.encode(secret, "utf8")
  });
  master = master.toJSON(true);
  master = JSON.stringify(master, null, "  ") + "\n";
  await fs.writeFile(output, master);
}
main();
