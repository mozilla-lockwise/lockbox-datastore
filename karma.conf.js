// Karma configuration

let setup = require("./karma.conf-base.js");

module.exports = function(config) {
  setup(config, {
    // single run ONLY
    singleRun: true,
    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ["Firefox"]
  });
};
