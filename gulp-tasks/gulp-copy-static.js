const gulp = require('gulp');
const plumber = require('gulp-plumber');

/**
 * @description Clean function
 * @param {string} input path to folder for copy
 * @param {string} basePath input base path
 * @param {string} output destination path
 * @param {object} parameters
 * @returns {*} Compiled file
 */

const copy = (input, basePath, output, params = {}) => {
  return gulp
    .src(input, { base: basePath })
    .pipe(plumber())
    .pipe(gulp.dest(output))
    .on('end', () => {
      params.cb();
    });
};

module.exports = copy;
