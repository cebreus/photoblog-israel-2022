const browsersync = require('browser-sync').create();
const config = require('../gulpconfig');

/**
 * @description BrowserSync init and config
 */

/**
 *
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
 * @description BrowserSync reload
 */

/**
 *
 * @param done
 */
function browserSyncRefresh(done) {
  browsersync.reload();
  done();
}

/**
 *
 */
function browserSyncReload() {
  browsersync.reload();
}

module.exports = { browserSync, browserSyncRefresh, browserSyncReload };
