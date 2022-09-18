const gulp = require('gulp');
const gulpif = require('gulp-if');
const imagemin = require('gulp-imagemin');
const log = require('fancy-log');
const mozjpeg = require('imagemin-mozjpeg');
const newer = require('gulp-newer');
const plumber = require('gulp-plumber');
const upng = require('gulp-upng');

/**
 * @description Function for optimizing JPEG images
 * @param {string} input Path to JPEG files
 * @param {string} output Path to save files
 * @param {boolean} params.rewriteExisting Switcher for rewriting files
 * @returns {*} Optimized JPEG images
 */

const optimizeJpg = (input, output, params = {}) => {
  const rewriteExisting = !!(
    params.rewriteExisting &&
    typeof params.rewriteExisting === 'boolean' &&
    params.rewriteExisting === true
  );

  if (params.verbose) {
    log(`    🟡 Start: ${output}/*.jpg`);
  }

  gulp
    .src(input)
    .pipe(plumber())
    .pipe(gulpif(!rewriteExisting, newer(output)))
    .pipe(
      imagemin([
        mozjpeg({
          quantTable: 3,
          dcScanOpt: 2,
        }),
      ])
    )
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`    🟡 End: ${output}/*.jpg`);
      }
      params.cb();
    });
};

/**
 * @description Function for optimizing PNG images
 * @param {string} input Path to PNG files
 * @param {string} output Path to save files
 * @param {boolean} params.rewriteExisting Switcher for rewriting files
 * @returns {*} Optimized PNG images
 */

const optimizePng = (input, output, params = {}) => {
  const rewriteExisting = !!(
    params.rewriteExisting &&
    typeof params.rewriteExisting === 'boolean' &&
    params.rewriteExisting === true
  );

  if (params.verbose) {
    log(`  🟡🟡 Start: ${output}/*.png`);
  }

  gulp
    .src(input)
    .pipe(plumber())
    .pipe(gulpif(!rewriteExisting, newer(output)))
    .pipe(upng({}))
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`  🟡🟡 End: ${output}/*.png`);
      }
      params.cb();
    });
};

/**
 * @description Function for optimizing SVG images
 * @param {string} input Path to SVG files
 * @param {string} output Path to save files
 * @param {boolean} params.rewriteExisting Switcher for rewriting files
 * @returns {*} Optimized SVG images
 */

const optimizeSvg = (input, output, params = {}) => {
  const rewriteExisting = !!(
    params.rewriteExisting &&
    typeof params.rewriteExisting === 'boolean' &&
    params.rewriteExisting === true
  );

  if (params.verbose) {
    log(`🟡🟡🟡 Start: ${output}/*.svg`);
  }
  gulp
    .src(input)
    .pipe(plumber())
    .pipe(gulpif(!rewriteExisting, newer(output)))
    .pipe(
      imagemin([
        imagemin.svgo({
          plugins: [
            {
              removeViewBox: false,
              collapseGroups: true,
            },
          ],
        }),
      ])
    )
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`🟡🟡🟡 End: ${output}/*.svg`);
      }
      params.cb();
    });
};

module.exports = {
  optimizeJpg,
  optimizePng,
  optimizeSvg,
};
