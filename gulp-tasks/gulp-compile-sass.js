const gulp = require('gulp');
const gulpConcat = require('gulp-concat');
const gulpEmptyPipe = require('gulp-empty-pipe');
const plumber = require('gulp-plumber');
const postcss = require('gulp-postcss');
const postcssSyntax = require('postcss-scss');
const prettify = require('gulp-jsbeautifier');
const sass = require('gulp-sass')(require('sass'));
const sassGlob = require('gulp-sass-glob');

/**
 * @description Compiling SCSS files into CSS files
 * @param {string} input Path with filter to source files
 * @param {string} output Path to save compiled files
 * @param {string} outputConcatFileName Output file name
 * @param {object} postcssPluginsBase Postcss plugins
 * @returns {*} Compiled file
 */

const compileSass = (
  input,
  output,
  outputConcatFileName,
  postcssPluginsBase,
  params = {}
) => {
  const processFile = outputConcatFileName ? gulpConcat : gulpEmptyPipe;

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(sassGlob())
    .pipe(sass())
    .on('error', sass.logError)
    .pipe(postcss(postcssPluginsBase, { syntax: postcssSyntax }))
    .pipe(prettify({ indent_size: 4 }))
    .pipe(processFile(outputConcatFileName))
    .pipe(gulp.dest(output))
    .on('end', () => {
      params.cb();
    });
};

module.exports = compileSass;
