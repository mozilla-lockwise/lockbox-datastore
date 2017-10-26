// Karma configuration

let setup = require("./karma.conf-base.js");

module.exports = function(config) {
  setup(config, {
    // custom mocha config
    client: {
      mocha: {
        timeout: 10000
      }
    },
    // single run ONLY
    singleRun: true,
    customLaunchers: {
      FirefoxHeadless: {
        base: "Firefox",
        flags: "-headless"
      }
    },
    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ["FirefoxHeadless"]
  });
};
