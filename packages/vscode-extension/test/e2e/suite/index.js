const { runExtensionHostTests } = require("./extension-host.test.js");

function run() {
  return new Promise(async (resolve, reject) => {
    try {
      await runExtensionHostTests();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { run };
