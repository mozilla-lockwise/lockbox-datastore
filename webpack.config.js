/*!
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const PATH = require("path");

module.exports = {
  devtool: "inline-source-map",
  module: {
    rules: [
      {
        test: /\.js$/,
        use: { loader: "babel-loader" },
        include: [PATH.resolve("lib"), PATH.resolve("test")]
      },
      {
        test: /\.js$/,
        use: { loader: "istanbul-instrumenter-loader" },
        include: PATH.resolve("lib")
      }
    ]
  }
};
