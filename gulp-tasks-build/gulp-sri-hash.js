const gulp = require('gulp');
const log = require('fancy-log');
const minify = require('gulp-htmlmin');
const sri = require('gulp-sri-hash');

/**
 * @function sriHash
 * @description Add sri integrity hashes into link tags in html
 * @param {string} input path to HTML files
 * @param {string} output path to save HTML files
 * @param {object} params
 * @returns {*} HTML files with integrity hashes
 */

const sriHash = (input, output, params = {}) => {
  const cb = params.cb || (() => {});

  if (typeof cb !== 'function') {
    throw new Error('Callback in params should be of type function.');
  }

  return (
    gulp
      .src(input)
      .pipe(sri())
      // Duplicate from `./gulp-html-build.js` because 'sri' converts `defer` to `defer=""`
      .pipe(
        minify({
          collapseWhitespace: true,
          collapseBooleanAttributes: true,
        })
      )
      .pipe(gulp.dest(output))
      .on('end', () => {
        if (params.verbose) {
          log(`         SRI integrity hashes rewrite in ${output}`);
        }
        cb();
      })
  );
};

module.exports = sriHash;
