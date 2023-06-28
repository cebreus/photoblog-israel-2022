const gulp = require('gulp');
const gulpClean = require('gulp-clean');
const log = require('fancy-log');
const plumber = require('gulp-plumber');

/**
 * @description Clean function
 * @param {string} input path to folder or file that you want to remove
 * @returns {*} Compiled file
 */

const clean = (input, params = {}) => {
  const cb = params.cb || (() => {});

  if (typeof cb !== 'function') {
    throw new Error('Callback in params should be of type function.');
  }

  return gulp
    .src(input, { read: false, allowEmpty: true })
    .pipe(plumber())
    .pipe(gulpClean())
    .on('end', () => {
      if (params.verbose) {
        log(`         Files in '${input}' deleted.`);
      }
      cb();
    });
};

module.exports = clean;
