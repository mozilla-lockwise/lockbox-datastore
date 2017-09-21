#! /usr/bin/env node
/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const jose = require("node-jose");
const fs = require("promisified-fs");
const yargs = require("yargs");
const PASSWORD = require("password");

const PASSWORD_PREFIX = "-GV3ItzyNxfBGp3ZjtqVGswWWlT7tIMZjeXanHqhxm0";

var argv = yargs.
  option("secret", {
    desc: "the secret passphrase to use",
    default: "resin peccadillo cartage circumnavigate arithmetic reverential",
    requiresArg: true
  }).
  option("random", {
    desc: "if a random passphrase should be generated (ignores --secret and --empty)",
    boolean: true
  }).
  option("empty", {
    desc: "if an 'empty' passphrase should be used (ignores --secret)",
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
  let { empty, random, secret, output } = argv;
  if (random) {
    secret = PASSWORD(4);
  } else if (empty) {
    secret = "";
  }

  let value = PASSWORD_PREFIX + secret;
  let master = await jose.JWK.asKey({
    kty: "oct",
    k: jose.util.base64url.encode(value, "utf8"),
    secret: secret
  });
  master = master.toJSON(true);
  master = JSON.stringify(master, null, "  ") + "\n";
  await fs.writeFile(output, master);
}

main();
