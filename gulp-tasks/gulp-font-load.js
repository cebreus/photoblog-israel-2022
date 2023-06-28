const googleWebFonts = require('gulp-google-webfonts');
const gulp = require('gulp');
const log = require('fancy-log');

/**
 * @description Download font from fonts.google.com into font folder and link them in fonts.css
 * @param {string} input Path to fonts.list file
 * @param {string} output Path to save files
 * @param {object} params Settings for googleWebFonts package
 * @returns {*} fonts in woff format inside font folder and fonts.css in css folder
 */

const fontLoad = (input, output, params) => {
  const cb = params.cb || (() => {});

  if (typeof cb !== 'function') {
    throw new Error('Callback in params should be of type function.');
  }

  return gulp
    .src(input)
    .pipe(googleWebFonts(params.config))
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log('         Font processed');
      }
      cb();
    });
};

module.exports = fontLoad;
