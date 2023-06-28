const gulp = require('gulp');
const log = require('fancy-log');
const plumber = require('gulp-plumber');

/**
 * @function copy
 * @description Copies static files from one location to another.
 * @param {string} input Input path or file pattern to copy
 * @param {string} basePath Base path for Gulp to search files
 * @param {string} output Destination path
 * @param {object} Additional parameters with callback function
 * @returns {void}
 */

const copy = (input, basePath, output, params = {}) => {
  const cb = params.cb || (() => {});

  if (typeof cb !== 'function') {
    throw new Error('Callback in params should be of type function.');
  }

  return gulp
    .src(input, { base: basePath })
    .pipe(plumber())
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`         Copied files from '${input}' to '${output}'`);
      }
      cb();
    });
};

module.exports = copy;
