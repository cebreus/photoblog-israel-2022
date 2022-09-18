const gulp = require('gulp');
const rev = require('gulp-rev');
const revDelete = require('gulp-rev-delete-original');
const revReplace = require('gulp-rev-replace');
const revRewrite = require('gulp-rev-rewrite');

/**
 * @description Add version hash to files
 * @param {string} inputRevision path to CSS files
 * @param {string} outputRevision path to save files
 * @param {string} outPutManifest path to save manifest file
 * @param {string} inputRewrite path to HTML files which you want to rewrite
 * @param {string} manifestFile path to manifest file
 * @param {string} outputRewrite path to save rewrited HTML files
 * @returns {*} Files with version hash
 */

const revision = (params) => {
  return (
    gulp
      .src(params.inputRevision)
      .pipe(rev())
      .pipe(revReplace())
      .pipe(revDelete())
      .pipe(gulp.dest(params.outputRevision))
      .pipe(gulp.dest(params.ouputManifest))
      .pipe(gulp.src(params.inputRewrite))
      .pipe(revRewrite(params.manifestFile))
      .pipe(gulp.dest(params.outputRewrite))
      // .pipe(gulpBrotli())
      // .pipe(gulp.dest(params.outputRewrite))
      .on('end', () => {
        params.cb();
      })
  );
};
module.exports = revision;
