const gulp = require('gulp');
const log = require('fancy-log');
const revDelete = require('gulp-rev-delete-original');
const revReplace = require('gulp-rev-replace');
const revRewrite = require('gulp-rev-rewrite');
const { loadPlugin } = require('../gulp-tasks/helpers');

/**
 * @async
 * @function revision
 * @description Creates a revision (a unique hash) for each asset, updates the references in HTML files, deletes old revisioned files, and optionally compresses the HTML files.
 * @param {object} params - The parameters object.
 * @param {string[]} params.inputRevision The glob or path of the files to create a revision for.
 * @param {string} params.outputRevision The path of the directory where the revisioned files should be written.
 * @param {string} params.ouputManifest The path of the directory where the manifest file should be written.
 * @param {string[]} params.inputRewrite The glob or path of the HTML files to update the references in.
 * @param {string} params.manifestFile The path of the manifest file used to update the references in HTML files.
 * @param {string} params.outputRewrite The path of the directory where the rewritten HTML files should be written.
 * @param {boolean} [params.verbose=false] If true, logs additional information.
 * @param {function} [params.cb=null] An optional callback function to be called when the revisioning and rewriting is done.
 * @returns {stream.Transform} A Gulp stream which can be piped to other functions or tasks.
 * @throws {Error} Throws an error if the 'gulp-rev' plugin cannot be loaded.
 */

const revision = async (params) => {
  const rev = await loadPlugin('gulp-rev');
  const cb = params.cb || (() => {});

  if (typeof cb !== 'function') {
    throw new Error('Callback in params should be of type function.');
  }

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
        if (params.verbose) {
          log(
            `         Unique asset hashes, updates HTML references, removes old hashes done.`,
          );
        }
        cb();
      })
  );
};

module.exports = revision;
