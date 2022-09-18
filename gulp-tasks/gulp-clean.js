const gulp = require('gulp');
const gulpClean = require('gulp-clean');
const plumber = require('gulp-plumber');

/**
 * @description Clean function
 * @param {string} input path to folder or file that you want to remove
 * @returns {*} Compiled file
 */

const clean = (input) => {
  return gulp
    .src(input, { read: false, allowEmpty: true })
    .pipe(plumber())
    .pipe(gulpClean());
};

module.exports = clean;
