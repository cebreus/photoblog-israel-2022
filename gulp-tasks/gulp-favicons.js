const gulp = require('gulp');
const log = require('fancy-log');
const { loadPlugin } = require('./helpers');

/**
 * @description generate favicon from source file
 * @param {string} input path to source icon
 * @param {string} output path to save icons
 * @param {object} params cofiguration for favicon generator
 */

const iconGenerator = async (input, output, params) => {
  const favicons = await loadPlugin('gulp-favicons');
  const cb = params.cb || (() => {});

  if (typeof cb !== 'function') {
    throw new Error('Callback in params should be of type function.');
  }

  return gulp
    .src(input)
    .pipe(favicons(params.config))
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`         Favicons created`);
      }
      cb();
    });
};

module.exports = iconGenerator;
