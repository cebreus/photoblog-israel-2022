const babel = require('gulp-babel');
const gulp = require('gulp');
const gulpConcat = require('gulp-concat');
const gulpif = require('gulp-if');
const newer = require('gulp-newer');
const plumber = require('gulp-plumber');
const uglify = require('gulp-uglify');

/**
 * @description Transpile JavaScript files
 * @param {string,object} input Path with filter to source files
 * @param {string} output Path to save transpiled files
 * @param {object} params
 * @returns {*} Transpiled file/files
 */

const processJs = (input, output, params = {}) => {
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
      params.cb();
    });
};

module.exports = processJs;
