const gulp = require('gulp');
const log = require('fancy-log');
const plumber = require('gulp-plumber');
const purgecss = require('gulp-purgecss');

/**
 * @function purgeCss
 * @description Removes unused CSS from stylesheets, processing the input CSS files based on the referenced HTML content.
 * @param {string|string[]} inputCss Path(s) to the input CSS file(s).
 * @param {string|string[]} inputHtml Path(s) to the HTML file(s) used for purging unused CSS.
 * @param {string} outputCss Path to the output directory for the purged CSS.
 * @param {Object} params Optional parameters for CSS purging.
 * @param {boolean} params.verbose Flag indicating if verbose logging should be enabled.
 * @param {function} params.cb Callback function to be executed at the end of the stream.
 * @returns {Object} - Gulp stream.
 */

const purgeCss = (inputCss, inputHtml, outputCss, params = {}) => {
  const cb = params.cb || (() => {});

  if (typeof cb !== 'function') {
    throw new Error('Callback in params should be of type function.');
  }

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
            'loaded',
          ],
        },
        // rejected: true,
      }),
    )
    .pipe(gulp.dest(outputCss))
    .on('end', () => {
      if (params.verbose) {
        log(`         PurgeCSS done.`);
      }
      cb();
    });
};

module.exports = purgeCss;
