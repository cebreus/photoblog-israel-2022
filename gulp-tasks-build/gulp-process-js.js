const babel = require('gulp-babel');
const gulp = require('gulp');
const gulpConcat = require('gulp-concat');
const gulpif = require('gulp-if');
const log = require('fancy-log');
const newer = require('gulp-newer');
const plumber = require('gulp-plumber');
const uglify = require('gulp-uglify');

/**
 * @function processJs
 * @description Processes JavaScript files using babel, uglify, and optionally concatenation.
 * @param {string} input Path to the input JavaScript files.
 * @param {string} output Path to the output directory.
 * @param {Object} params Optional parameters for JavaScript processing.
 * @param {boolean} params.rewriteExisting Flag indicating if existing files should be rewritten.
 * @param {boolean} params.concatFiles Flag indicating if files should be concatenated.
 * @param {string} params.outputConcatPrefixFileName Prefix for the concatenated output file name.
 * @param {boolean} params.verbose Flag indicating if verbose logging should be enabled.
 * @param {function} params.cb Callback function to be executed at the end of the stream.
 * @returns {Object} Gulp stream.
 */

const processJs = (input, output, params = {}) => {
  const cb = params.cb || (() => {});

  if (typeof cb !== 'function') {
    throw new Error('Callback in params should be of type function.');
  }

  const rewriteExisting = !!(
    params.rewriteExisting &&
    typeof params.rewriteExisting === 'boolean' &&
    params.rewriteExisting === true
  );

  const concatFiles = !!(
    params.concatFiles &&
    typeof params.concatFiles === 'boolean' &&
    params.concatFiles === true
  );

  const outputConcatFileName = `${params.outputConcatPrefixFileName}.min.js`;

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(gulpif(!rewriteExisting, newer(output)))
    .pipe(
      babel({
        presets: [
          [
            '@babel/preset-env',
            {
              targets: {
                browsers: ['last 2 versions'],
              },
            },
          ],
        ],
      })
    )
    .pipe(uglify())
    .pipe(gulpif(concatFiles, gulpConcat(outputConcatFileName)))
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`         JS files processed.`);
      }
      cb();
    });
};

module.exports = processJs;
