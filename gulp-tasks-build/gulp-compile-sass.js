const gulp = require('gulp');
const gulpConcat = require('gulp-concat');
const gulpEmptyPipe = require('gulp-empty-pipe');
const log = require('fancy-log');
const plumber = require('gulp-plumber');
const postcss = require('gulp-postcss');
const postcssSyntax = require('postcss-scss');
const replace = require('gulp-replace');
const sass = require('gulp-sass')(require('sass'));
const sassGlob = require('gulp-sass-glob');

/**
 * @function compileSass
 * @description Compiles SASS files, applies PostCSS plugins, optionally concatenates them, and writes to output directory.
 * @param {string} input Source SASS files path.
 * @param {string} output Output directory path.
 * @param {string|null} outputConcatFileName Output file name for concatenation, null otherwise.
 * @param {Array} postcssPluginsBase Array of PostCSS plugins.
 * @param {Object} params Optional parameters: { verbose: boolean, cb: function }
 * @returns {Object} Gulp stream.
 */

const compileSass = (
  input,
  output,
  outputConcatFileName,
  postcssPluginsBase,
  params = {},
) => {
  const cb = params.cb || (() => {});

  if (typeof cb !== 'function') {
    throw new Error('Callback in params should be of type function.');
  }

  const processFile = outputConcatFileName ? gulpConcat : gulpEmptyPipe;

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(sassGlob())
    .pipe(sass())
    .on('error', sass.logError)
    .pipe(replace(/\/\*!/g, '/*'))
    .pipe(replace('@charset "UTF-8";', ''))
    .pipe(postcss(postcssPluginsBase, { syntax: postcssSyntax }))
    .pipe(processFile(outputConcatFileName))
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`         SASS processed`);
      }
      cb();
    });
};

module.exports = compileSass;
