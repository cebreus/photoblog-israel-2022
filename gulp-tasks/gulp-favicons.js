const favicons = require('gulp-favicons');
const gulp = require('gulp');

/**
 * @description generate favicon from source file
 * @param {string} input path to source icon
 * @param {string} output path to save icons
 * @param {object} params cofiguration for favicon generator
 */

const iconGenerator = (input, output, params) => {
  return gulp
    .src(input)
    .pipe(favicons(params.config))
    .pipe(gulp.dest(output))
    .on('end', () => {
      params.cb();
    });
};

module.exports = iconGenerator;
