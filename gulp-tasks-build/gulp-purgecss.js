const gulp = require('gulp');
const plumber = require('gulp-plumber');
const purgecss = require('gulp-purgecss');

/**
 * @description Purge unused CSS selectors
 * @param {string} inputCss path to source CSS files
 * @param {string} inputHtml path to source HTML files
 * @param {string} outputCss path to folder to save optimized files
 * @param {object} params
 * @returns {*} processed files
 */

const purgeCss = (inputCss, inputHtml, outputCss, params = {}) => {
  return gulp
    .src(inputCss)
    .pipe(plumber())
    .pipe(
      purgecss({
        content: inputHtml,
        safelist: {
          standard: [
            'active',
            'collapsing',
            'fade',
            'offcanvas-backdrop',
            'open',
            'scroll',
            'show',
          ],
        },
        // rejected: true,
      })
    )
    .pipe(gulp.dest(outputCss))
    .on('end', () => {
      params.cb();
    });
};

module.exports = purgeCss;
