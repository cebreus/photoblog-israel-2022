const gulp = require('gulp');
const log = require('fancy-log');
const validate = require('gulp-html-validate');

/**
 * @function htmlValidate
 * @description Validates HTML files with `html-validate` and logs the results.
 * @param {string} input Path to the HTML files to be validated.
 * @param {object} [params={}] An optional parameters object.
 * @param {boolean} [params.verbose=false] If true, logs additional information.
 * @param {function} [params.cb=null] An optional callback function to be called when validation is done.
 * @returns {stream.Transform} A gulp stream which can be piped to other functions or tasks.
 */

const htmlValidate = (input, params = {}) => {
  const cb = params.cb || (() => {});

  if (typeof cb !== 'function') {
    throw new Error('Callback in params should be of type function.');
  }

  return gulp
    .src(input)
    .pipe(validate())
    .pipe(validate.format())
    .pipe(validate.failAfterError())
    .on('end', () => {
      if (params.verbose) {
        log(`         HTML validation in ${input}`);
      }
      cb();
    });
};

module.exports = htmlValidate;
