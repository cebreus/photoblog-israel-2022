const gulp = require('gulp');
const sri = require('gulp-sri-hash');

/**
 * @description Add sri integrity hashes into link tags in html
 * @param {string} input path to HTML files
 * @param {string} output path to save HTML files
 * @param {object} params
 * @returns {*} HTML files with integrity hashes
 */

const sriHash = (input, output, params = {}) => {
  return gulp
    .src(input)
    .pipe(sri())
    .pipe(gulp.dest(output))
    .on('end', () => {
      params.cb();
    });
};

module.exports = sriHash;
