const fs = require('fs');
const gulp = require('gulp');
const jeditor = require('gulp-json-editor');
const log = require('fancy-log');
const markdownToJSON = require('gulp-markdown-to-json');
const plumber = require('gulp-plumber');
const rename = require('gulp-rename');
const through2 = require('through2');
const { marked } = require('marked');
const { groupBy, mkdirr, readFilesSync, sortByDate } = require('./helpers');

/**
 * @description Convert *.md to *.json
 * @param {string} input Path source *.md
 * @param {string} output Path to save files
 * @param {object} params
 * @returns {*} Processed files
 */

const datasetPrepare = (input, output, params = {}) => {
  const files = [];

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(markdownToJSON(marked))
    .pipe(
      rename((path) => {
        if (path.dirname === '.' && path.basename === 'index') {
          return {
            basename: path.basename,
            dirname: '/',
            extname: '.json',
          };
        }
        if (path.dirname !== '.') {
          return {
            basename: path.dirname,
            dirname: '/',
            extname: '.json',
          };
        }
        return '';
      })
    )
    .pipe(gulp.dest(output))
    .pipe(
      through2.obj((file, enc, cb) => {
        files.push(file.path);
        cb();
      })
    )
    .on('end', () => {
      if (params.verbose) {
        log(`         ${files.length} JSON written`);
      }
      params.cb();
    });
};

/**
 * @description Convert *.md to *.json and add new keys
 * @param {string} input Path source *.md
 * @param {string} output Path to save files
 * @param {string} cb Callbacks
 * @returns {*} Processed files
 */

const datasetPrepareNotes = (input, output, params = {}) => {
  const files = [];
  mkdirr(output);

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(markdownToJSON(marked))
    .pipe(
      jeditor((json) => {
        json.kind = 'markdown';
        json.groupBy = json.date.substring(0, 10);
        json.titleLength = json.title.length;
        json.excerptLength = json.excerpt.length;
        if (json.accordions) {
          json.accordionsLength = json.accordions.length;
        }
        return json; // must return JSON object.
      })
    )
    .pipe(gulp.dest(output))
    .pipe(
      through2.obj((file, enc, cb) => {
        files.push(file.path);
        cb();
      })
    )
    .on('end', () => {
      if (params.verbose) {
        log(`         ${files.length} JSON written`);
      }
      params.cb();
    });
};

/**
 * @description Concatenate, sort and group *.json
 * @param {string} input Path source *.json
 * @param {string} outputDir Path to save file
 * @param {string} outputFilename Name of the saved file
 * @param {string} cb Callbacks
 * @returns {*} Processed file
 */

const datasetNotesAndImages = (input, outputFilename, params = {}) => {
  const files = readFilesSync(input);

  if (params.verbose && params.verbose !== 'brief') {
    log(`         input:          ${input}`);
    log(`         outputFilename: ${outputFilename}`);
    log(`         ${files.length} JSON read`);
  }

  let data = [];
  files.forEach((file) => {
    const filePath = file.filepath;
    if (file.stat.size > 0) {
      const data1 = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (params.keywords) {
        if (data1.keywords) {
          data.push(data1);
        }
      } else {
        data.push(data1);
      }
    }
  });

  data.sort(sortByDate);
  data = groupBy(data, 'groupBy');

  return fs.writeFile(outputFilename, JSON.stringify(data), 'utf8', (err) => {
    if (err) {
      return log.error(err);
    }
    if (params.verbose) {
      log(`         File '${outputFilename}' is written`);
    }
    return params.cb();
  });
};

module.exports = {
  datasetPrepare,
  datasetPrepareNotes,
  datasetNotesAndImages,
};
