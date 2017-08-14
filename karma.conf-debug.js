// Karma configuration

let setup = require("./karma.conf-base.js");

module.exports = function(config) {
  setup(config, {
    // disable single run
    singleRun: false
  });
}
