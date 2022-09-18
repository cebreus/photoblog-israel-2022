const base64 = require('gulp-base64-inline');
const data = require('gulp-data');
const dateFilter = require('nunjucks-date-filter-locale');
const fs = require('fs');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const inject = require('gulp-inject');
const log = require('fancy-log');
const markdown = require('nunjucks-markdown-filter');
const nunjucksRender = require('gulp-nunjucks-render');
const plumber = require('gulp-plumber');
const prettify = require('gulp-html-beautify');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
require('dotenv').config();

/**
 * @description Compile Nunjucks templates and replaces variable from JSON
 * @param {string} input Path with filter to source files
 * @param {string} output Path to save compiled files
 * @param {string} dataSource Input file/path with data structure
 * @param {string} rename Custom name of file
 * @param {string} injectCss Path to css files which you want inject
 * @param {Array} injectJs Path to JS files which you want inject
 * @param {Array} injectCdnJs Path to CDN JS files which you want inject
 * @returns {*} Compiled file
 */

const buildHtml = (params) => {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const localeSettings = require(`.${params.siteConfig}`);
  dateFilter.setLocale(localeSettings.meta.lang);

  let existsJson = false;
  let findJson = true;
  let currentFile = '';
  const renameCondition = !!params.rename;
  let oldDataSource = '';

  if (params.dataSource.includes('.json')) {
    if (typeof params.dataSource !== 'object') {
      params.dataSource = [params.dataSource];
    }

    params.dataSource.forEach((element) => {
      try {
        fs.accessSync(element);
        existsJson = true;
        findJson = false;
      } catch (error) {
        log.error(`buildHtml(): JSON file ${element} doesn't exists.`);
        existsJson = false;
        findJson = false;
      }
    });
  }

  nunjucksRender.nunjucks.configure(params.templates, {
    watch: false,
    lstripBlocks: true,
    throwOnUndefined: true,
    trimBlocks: true,
    stream: true,
  });

  return (
    gulp
      .src(params.input)
      .pipe(plumber())
      .pipe(
        rename((path) => {
          currentFile = path;
          if (currentFile.dirname !== '.') {
            const file = JSON.parse(
              fs.readFileSync(
                `${process.cwd()}/${params.dataSource}/${
                  currentFile.dirname
                }.json`,
                'utf8'
              )
            );
            oldDataSource = currentFile.dirname;
            if (file.seo.slug) {
              currentFile.dirname = file.seo.slug;
            }
          }
        })
      )
      // Add access to site configuration
      .pipe(
        data(() => {
          let file = params.siteConfig;
          file = {
            SITE: {
              ...JSON.parse(fs.readFileSync(file)),
            },
          };
          return file;
        })
      )
      // Add access to all images data
      .pipe(
        data(() => {
          let file = params.dataSourceImages;
          file = {
            IMAGES: {
              ...JSON.parse(
                fs.readFileSync(file, {
                  encoding: 'utf8',
                })
              ),
            },
          };
          return file;
        })
      )
      .pipe(
        gulpif(
          existsJson,
          data(() => {
            let file;
            params.dataSource.forEach((element) => {
              file = {
                ...file,
                ...JSON.parse(fs.readFileSync(element)),
              };
            });
            return file;
          })
        )
      )
      .pipe(
        gulpif(
          findJson,
          data(() => {
            if (currentFile.dirname !== '.') {
              const file = JSON.parse(
                fs.readFileSync(
                  `${process.cwd()}/${params.dataSource}/${oldDataSource}.json`
                )
              );
              return file;
            }
            return '';
          })
        )
      )
      .pipe(
        nunjucksRender({
          data: { SOURCE: process.env.SOURCE },
          path: params.processPaths,
          manageEnv: (enviroment) => {
            enviroment.addFilter('date', dateFilter);
            enviroment.addFilter('md', markdown);
            enviroment.addFilter(
              'unique',
              (arr) =>
                (arr instanceof Array &&
                  arr.filter((e, i, arr1) => arr1.indexOf(e) === i)) ||
                arr
            );
            enviroment.addGlobal('toDate', (date) => {
              return date ? new Date(date) : new Date();
            });
          },
        })
      )
      .pipe(
        inject(
          gulp.src(params.injectCss, {
            read: false,
          }),
          {
            relative: false,
            ignorePath: params.injectIgnorePath,
            addRootSlash: true,
            removeTags: true,
          }
        )
      )
      .pipe(
        inject(
          gulp.src(params.injectJs, {
            read: false,
          }),
          {
            relative: false,
            ignorePath: params.injectIgnorePath,
            addRootSlash: true,
            removeTags: true,
          }
        )
      )
      .pipe(
        replace(
          '<!-- inject: bootstrap js -->',
          params.injectCdnJs.toString().replace(/[, ]+/g, ' ')
        )
      )
      .pipe(
        base64('', {
          prefix: '',
          suffix: '',
        })
      )
      .pipe(
        prettify({
          indentSize: 4,
          indent_char: ' ',
          indent_with_tabs: false,
          preserve_newlines: false,
        })
      )
      .pipe(
        gulpif(
          renameCondition,
          rename({
            dirname: '/',
            basename: params.rename,
            extname: '.html',
          })
        )
      )
      .pipe(gulp.dest(params.output))
      .on('end', () => {
        params.cb();
      })
  );
};

module.exports = buildHtml;
