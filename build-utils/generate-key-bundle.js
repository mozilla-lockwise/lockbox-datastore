#! /usr/bin/env node
/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const jose = require("node-jose");
const fs = require("promisified-fs");
const yargs = require("yargs");

const DEFAULT_APP_KEY = {
  "kty": "oct",
  "kid": "L9-eBkDrYHdPdXV_ymuzy_u9n3drkQcSw5pskrNl4pg",
  "alg": "A256GCM",
  "k": "WsTdZ2tjji2W36JN9vk9s2AYsvp8eYy1pBbKPgcSLL4"
};
const HKDF_INFO_ENCRYPT = "lockbox encrypt",
      HKDF_INFO_HASHING = "lockbox hashing";

async function deriveKeys(appKey, salt) {
  if (!appKey) {
    appKey = DEFAULT_APP_KEY;
  }
  appKey = await jose.JWK.asKey(appKey);

  if (!salt) {
    salt = jose.util.base64url.encode(jose.util.randomBytes(16));
  }

  let keyval = appKey.get("k", true);
  let encryptKey = await jose.JWA.derive("HKDF-SHA-256", keyval, {
    salt: Buffer.from(salt),
    info: Buffer.from(HKDF_INFO_ENCRYPT)
  });
  encryptKey = await jose.JWK.asKey({
    kty: "oct",
    alg: "A256GCM",
    k: encryptKey
  });

  let hashingKey = await jose.JWA.derive("HKDF-SHA-256", keyval, {
    salt: Buffer.from(salt),
    info: Buffer.from(HKDF_INFO_HASHING)
  });
  hashingKey = await jose.JWK.asKey({
    kty: "oct",
    alg: "HS256",
    k: hashingKey
  });

  return {
    encryptKey,
    hashingKey,
    salt
  };
}

var argv = yargs.
  option("output", {
    desc: "the file to write the results to",
    required: true,
    requiresArg: true
  }).
  help().
  argv;

async function main() {
  let { output } = argv;

  let ks = jose.JWK.createKeyStore();
  let appKey = await ks.generate("oct", 256, {
    alg: "A256GCM"
  });
  let bundle = await deriveKeys(appKey);
  bundle.appKey = appKey;
  Object.keys(bundle).forEach((k) => {
    if (!jose.JWK.isKey(bundle[k])) { return; }
    bundle[k] = bundle[k].toJSON(true);
  });
  bundle = JSON.stringify(bundle, null, "  ") + "\n";
  await fs.writeFile(output, bundle);
}

main();
