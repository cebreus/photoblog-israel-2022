const browsersync = require('browser-sync').create();
const config = require('../gulpconfig');

/**
 * @function browserSync
 * @description Initialize BrowserSync with given configuration
 */

function browserSync() {
  browsersync.init({
    server: {
      baseDir: config.buildBase,
    },
    port: 4000,
    notify: false,
    open: false,
  });
}

/**
 * @function browserSyncRefresh
 * @description Refresh BrowserSync
 * @param {function} done - Callback function to notify completion
 */

function browserSyncRefresh(done) {
  browsersync.reload();
  done();
}

/**
 * @function browserSyncReload
 * @description Reload BrowserSync
 */

function browserSyncReload() {
  browsersync.reload();
}

module.exports = { browserSync, browserSyncRefresh, browserSyncReload };
