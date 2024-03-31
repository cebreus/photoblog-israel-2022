const fs = require('fs');
const gulp = require('gulp');
const jeditor = require('gulp-json-editor');
const log = require('fancy-log');
const markdownToJSON = require('gulp-markdown-to-json');
const plumber = require('gulp-plumber');
const rename = require('gulp-rename');
const through2 = require('through2');
const { marked } = require('marked');
const { groupBy, readFilesSync, sortByDate } = require('./helpers');

marked.setOptions({
  mangle: false,
  headerIds: false,
});

function ensureCbIsFunction(params) {
  const cb = params.cb || (() => {});
  if (typeof cb !== 'function') {
    throw new Error('Callback in params should be of type function.');
  }
  return cb;
}

function subtractOneSecond(isoDateString) {
  const date = new Date(isoDateString);
  date.setSeconds(date.getSeconds() - 1);
  return date.toISOString();
}

function modifyPath(path) {
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
}

function modifyJson(json) {
  json.kind = 'markdown';
  json.groupBy = json.date.substring(0, 10);
  json.titleLength = json.title.length;
  json.excerptLength = json.excerpt.length;
  if (json.accordions) {
    json.accordionsLength = json.accordions.length;
  }
  return json;
}

function prepareDataset(input, output, params = {}, jsonModifier = undefined) {
  const files = [];
  const callback = ensureCbIsFunction(params);

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(markdownToJSON(marked))
    .pipe(jsonModifier ? jeditor(jsonModifier) : rename(modifyPath))
    .pipe(gulp.dest(output))
    .pipe(
      through2.obj((file, enc, cb) => {
        files.push(file.path);
        if (params.verbose && params.verbose !== 'brief') {
          log(`         Written file '${file.path}'`);
        }
        cb();
      }),
    )
    .on('end', () => {
      if (params.verbose) {
        log(`         ${files.length} JSON written`);
      }
      callback();
    });
}

const datasetPrepare = (input, output, params = {}) =>
  prepareDataset(input, output, params);

const datasetPrepareNotes = (input, output, params = {}) => {
  return prepareDataset(input, output, params, modifyJson);
};

const datasetNotesAndImages = (input, outputFilename, params = {}) => {
  const callback = ensureCbIsFunction(params);
  const files = readFilesSync(input);

  if (params.verbose && params.verbose !== 'brief') {
    log(`         input:          ${input}`);
    log(`         outputFilename: ${outputFilename}`);
    log(`         ${files.length} JSON read`);
  }

  const dataset = files
    .filter((file) => file.stat.size > 0)
    .map((file) => JSON.parse(fs.readFileSync(file.filepath, 'utf8')))
    .filter((data) => (params.keywords ? data.keywords : true));

  dataset.sort(sortByDate);

  let modifiedDataset = [];
  let previousWhere = '';
  let whereCount = 0;
  let insertPosition = 0;
  let firstInGroup = null;

  dataset.forEach((item) => {
    if (item.where && item.where === previousWhere) {
      whereCount += 1;
      if (whereCount === 1) {
        firstInGroup = item;
      }
      if (whereCount === 2) {
        const adjustedDate = subtractOneSecond(firstInGroup.date);

        modifiedDataset.splice(insertPosition, 0, {
          kind: 'location',
          where: item.where,
          date: adjustedDate,
          groupBy: firstInGroup.groupBy,
          city: item.city,
        });
        if (params.verbose) {
          log(
            `Inserted 'location' kind object for '${item.where}' at the start of its group.`,
          );
        }
      }
    } else {
      insertPosition = modifiedDataset.length;
      whereCount = 1;
      firstInGroup = item;
    }
    modifiedDataset.push(item);
    previousWhere = item.where;
  });

  modifiedDataset = groupBy(modifiedDataset, 'groupBy');

  fs.writeFile(
    outputFilename,
    JSON.stringify(modifiedDataset),
    'utf8',
    (err) => {
      if (err) {
        return log.error(err);
      }
      if (params.verbose) {
        log(`         Written file '${outputFilename}'`);
      }
      callback();
      return null;
    },
  );
};

module.exports = {
  datasetPrepare,
  datasetPrepareNotes,
  datasetNotesAndImages,
};
