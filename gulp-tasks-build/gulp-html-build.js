const data = require('gulp-data');
const dateFilter = require('nunjucks-date-filter-locale');
const fs = require('fs');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const inject = require('gulp-inject');
const log = require('fancy-log');
const markdown = require('nunjucks-markdown-filter');
const minify = require('gulp-htmlmin');
const nunjucksRender = require('gulp-nunjucks-render');
const plumber = require('gulp-plumber');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const { loadEnvVariables, readJson } = require('../gulp-tasks/helpers');
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
  const localeSettings = readJson(`${params.siteConfig}`);
  dateFilter.setLocale(localeSettings.meta.lang);
  const cb = params.cb || (() => {});
  const envVariables = loadEnvVariables([
    'DATA_DIR',
    'BASE_URL',
    'SITE_TITLE',
    'APP_NAME',
    'APP_SHORT_NAME',
    'APP_DESCRIPTION',
    'DEVELOPER_NAME',
    'DEVELOPER_URL',
    'BACKGROUND',
    'THEME_COLOR',
  ]);
  const renameCondition = !!params.rename;
  let currentFile = '';
  let dataSourceFile = {};
  let existsJson = false;
  let findJson = true;
  let oldDataSource = '';
  let oldSourceFile = '';

  if (typeof cb !== 'function') {
    throw new Error('Callback in params should be of type function.');
  }

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
      .pipe(
        data(() => {
          const siteFile = {
            SITE: {
              ...JSON.parse(fs.readFileSync(params.siteConfig)),
            },
          };
          const imagesFile = {
            IMAGES: {
              ...JSON.parse(
                fs.readFileSync(params.dataSourceImages, { encoding: 'utf8' })
              ),
            },
          };
          const bestOfFile = {
            BESTOF: {
              ...JSON.parse(
                fs.readFileSync(params.dataSourceImagesBestOf, {
                  encoding: 'utf8',
                })
              ),
            },
          };
          if (existsJson) {
            params.dataSource.forEach((element) => {
              dataSourceFile = {
                ...dataSourceFile,
                ...JSON.parse(fs.readFileSync(element)),
              };
            });
          }
          if (findJson && currentFile.dirname !== '.') {
            oldSourceFile = JSON.parse(
              fs.readFileSync(
                `${process.cwd()}/${params.dataSource}/${oldDataSource}.json`
              )
            );
          }
          return {
            ...siteFile,
            ...imagesFile,
            ...bestOfFile,
            ...dataSourceFile,
            ...oldSourceFile,
          };
        })
      )
      .pipe(
        nunjucksRender({
          data: envVariables,
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
            quiet: true,
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
      // Performance optimisation on local JS libraries
      .pipe(replace('<script src="/assets/', '<script defer src="/assets/'))
      // Remove multi/line comments
      .pipe(replace(/( )*<!--((.*)|[^<]*|[^!]*|[^-]*|[^>]*)-->\n*/gm, ''))
      // Improve acessibility of basic tables
      .pipe(replace(/<th>/gm, '<th scope="col">'))
      .pipe(
        minify({
          collapseWhitespace: true,
          collapseBooleanAttributes: true,
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
        if (params.verbose) {
          log('         HTML files are builded.');
        }
        cb();
      })
  );
};

module.exports = buildHtml;
