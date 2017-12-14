#! /usr/bin/env node
/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const jose = require("node-jose"),
      fs = require("promisified-fs"),
      yargs = require("yargs"),
      UUID = require("uuid");


var argv = yargs.
  option("bundle", {
    desc: "the key bundle to use for encryption",
    required: true,
    requiresArg: true
  }).
  option("output", {
    desc: "the file to write the results to",
    required: true,
    requiresArg: true
  }).
  option("count", {
    desc: "the number of test item keys to generate",
    number: true,
    default: 4
  }).
  help().
  argv;

var keystore = jose.JWK.createKeyStore();

async function createItemKey() {
  let params = {
    alg: "A256GCM",
    kid: UUID()
  };
  return await keystore.generate("oct", 256, params);
}

async function main() {
  let { count, bundle, output } = argv;

  bundle = await fs.readFile(bundle, "utf8");
  bundle = JSON.parse(bundle);
  bundle.encryptKey = await jose.JWK.asKey(bundle.encryptKey);

  let itemKeys = {};
  for (let idx = 0; count > idx; idx++) {
    let k = await createItemKey();
    itemKeys[k.kid] = k.toJSON(true);
  }

  let params = {
    format: "compact",
    contentAlg: "A256GCM",
    fields: {
      alg: "dir"
    }
  };

  let { encryptKey, salt } = bundle;
  let encrypted;
  encrypted = JSON.stringify(itemKeys);
  encrypted = await jose.JWE.createEncrypt(params, encryptKey).final(encrypted, "utf8");

  let results = {
    encrypted,
    salt
  };
  results = JSON.stringify(results, null, "  ") + "\n";

  await fs.writeFile(output, results);
  // eslint-disable-next-line no-console
  console.log(`generated encrypted keysstore of ${count} keys: [${Object.keys(itemKeys).join(", ")}]`);
}

main();
