/* eslint-plugin-disable jsdoc */

const gulp = require('gulp');
const cleanFnc = require('./gulp-tasks/gulp-clean');
const config = require('./gulpconfig');
const copyStaticFnc = require('./gulp-tasks/gulp-copy-static');
const cssCompileFnc = require('./gulp-tasks/gulp-compile-sass');
const datasetBuildImagesFnc = require('./gulp-tasks/gulp-dataset-images');
const datasetPrepareFnc = require('./gulp-tasks/gulp-dataset-prepare');
const fontLoadFnc = require('./gulp-tasks/gulp-font-load');
const hotReload = require('./gulp-tasks/gulp-hotreload');
const htmlBuildFnc = require('./gulp-tasks/gulp-html-build');
const imagesOptimizeFnc = require('./gulp-tasks/gulp-optimize-images');
const imagesResize = require('./gulp-tasks/gulp-resize-images');
const jsProcessFnc = require('./gulp-tasks-build/gulp-process-js');
const todoFnc = require('./gulp-tasks/gulp-todo');
require('dotenv').config();

// Variables
// --------------

const showLogs = 'brief';

// Gulp functions
// --------------

function cleanFolders() {
  return cleanFnc(config.buildBase);
}

function copyStatic(done) {
  return copyStaticFnc(
    [
      `${config.staticBase}/*`,
      `${config.staticBase}/**/*`,
      `${config.staticBase}/.*/*`,
    ],
    config.staticBase,
    config.buildBase,
    {
      cb: () => {
        done();
      },
    }
  );
}

// SASS

function compileSassCore(done) {
  return cssCompileFnc(
    config.sassCore,
    config.sassBuild,
    'bootstrap.css',
    config.postcssPluginsBase,
    {
      cb: () => {
        done();
      },
    }
  );
}

function compileSassCustom(done) {
  return cssCompileFnc(
    config.sassCustom,
    config.sassBuild,
    'custom.css',
    config.postcssPluginsBase,
    {
      cb: () => {
        done();
      },
    }
  );
}

function compileSassUtils(done) {
  return cssCompileFnc(
    config.sassUtils,
    config.sassBuild,
    'utils.css',
    config.postcssPluginsBase,
    {
      cb: () => {
        done();
      },
    }
  );
}

// JS

function processJs(done) {
  const params = {
    concatFiles: false,
    outputConcatPrefixFileName: 'app',
    cb: () => {
      done();
    },
  };

  return jsProcessFnc(config.jsFiles, config.jsBuild, params);
}

// Dataset

function datasetPrepareSite(done) {
  return datasetPrepareFnc.datasetPrepare(
    `${config.contentBase}/site.md`,
    config.tempBase,
    {
      verbose: showLogs,
      cb: () => {
        done();
      },
    }
  );
}

function datasetPreparePages(done) {
  return datasetPrepareFnc.datasetPrepare(
    config.datasetPagesSource,
    config.datasetPagesBuild,
    {
      verbose: showLogs,
      cb: () => {
        done();
      },
    }
  );
}

function datasetPrepareNotes(done) {
  return datasetPrepareFnc.datasetPrepareNotes(
    `${config.contentBase}/${process.env.DATA_DIR}/*.md`,
    `${config.tempBase}/_dataset`,
    {
      verbose: showLogs,
      cb: () => {
        done();
      },
    }
  );
}

function datasetPrepareImages(done) {
  return datasetBuildImagesFnc({
    inputDir: `${config.contentBase}/${process.env.DATA_DIR}`,
    inputExtMask: 'jpg|jpeg',
    jsonDir: `${config.tempBase}/_dataset`,
    outputJson: `${config.tempBase}/_dataset-images-notes.json`,
    extractParams: {
      tiff: false,
      xmp: true,
      exif: true,
      iptc: true,
    },
    verbose: showLogs,
    cb: () => {
      done();
    },
  });
}

function datasetNotesAndImages(done) {
  return datasetPrepareFnc.datasetNotesAndImages(
    `${config.tempBase}/_dataset`,
    `${config.tempBase}/_dataset-images-notes.json`,
    {
      verbose: showLogs,
      cb: () => {
        done();
      },
    }
  );
}

function datasetNotesAndImagesBestOf(done) {
  return datasetPrepareFnc.datasetNotesAndImages(
    `${config.tempBase}/_dataset`,
    `${config.tempBase}/_dataset-images-notes-best-of.json`,
    {
      // urgency: 1,
      keywords: 'prio2',
      verbose: showLogs,
      cb: () => {
        done();
      },
    }
  );
}

// Templates

function buildPages(done) {
  const params = {
    input: `${config.tplPagesBase}/**/*.html`,
    output: config.tplBuild,
    templates: config.tplTemplatesBase,
    processPaths: [config.tplPagesBase, config.tplTemplatesBase],
    siteConfig: `${config.tempBase}/site.json`,
    dataSourceImages: `${config.tempBase}/_dataset-images-notes.json`,
    dataSourceImagesBestOf: `${config.tempBase}/_dataset-images-notes-best-of.json`,
    dataSource: config.datasetPagesBuild,
    injectCdnJs: config.injectCdnJs,
    injectJs: config.injectJs,
    injectCss: config.injectCss,
    injectIgnorePath: config.buildBase.replace('./', ''),
    cb: () => {
      done();
    },
  };

  return htmlBuildFnc(params);
}

// GFX

function images(done) {
  const params = {
    verbose: showLogs,
    cb: () => {
      done();
    },
  };

  imagesOptimizeFnc.optimizeJpg(config.imagesJpg, config.gfxBuild, params);
  imagesOptimizeFnc.optimizePng(config.imagesPng, config.gfxBuild, params);
  imagesOptimizeFnc.optimizeSvg(config.imagesSvg, config.gfxBuild, params);
  imagesResize.details(
    `${config.contentBase}/${process.env.DATA_DIR}/*.jpg`,
    `${config.staticBase}/assets/${process.env.DATA_DIR}/details`,
    params
  );
  imagesResize.previews(
    `${config.contentBase}/${process.env.DATA_DIR}/*.jpg`,
    `${config.staticBase}/assets/${process.env.DATA_DIR}/previews`,
    params
  );
  imagesResize.previewsWebp(
    `${config.contentBase}/${process.env.DATA_DIR}/*.jpg`,
    `${config.staticBase}/assets/${process.env.DATA_DIR}/previews-webp`,
    params
  );
  imagesResize.previewsXl(
    `${config.contentBase}/${process.env.DATA_DIR}/*.jpg`,
    `${config.staticBase}/assets/${process.env.DATA_DIR}/previews-xl`,
    params
  );
  imagesResize.previewsXlWebp(
    `${config.contentBase}/${process.env.DATA_DIR}/*.jpg`,
    `${config.staticBase}/assets/${process.env.DATA_DIR}/previews-xl-webp`,
    params
  );
  return done();
}

// Fonts

function fontLoad(done) {
  fontLoadFnc(config.fontloadFile, config.tempBase, {
    config: config.fontLoadConfig,
    verbose: showLogs,
    cb: () => {
      done();
    },
  });
}

// Watch
// --------------

function watchFiles() {
  // Watch SASS

  gulp.watch(
    config.sassCustom,
    gulp.series(compileSassCustom, hotReload.browserSyncRefresh)
  );

  gulp.watch(
    config.sassCore,
    gulp.series(compileSassCore, hotReload.browserSyncRefresh)
  );

  gulp.watch(
    config.sassUtils,
    gulp.series(compileSassUtils, hotReload.browserSyncRefresh)
  );

  // Watch JS

  gulp.watch(
    config.jsFiles,
    gulp.series(processJs, hotReload.browserSyncRefresh)
  );

  // Watch Templates

  gulp
    .watch(['./src/templates/**/*.*', './src/pages/**/*.*'], buildPages)
    .on('change', hotReload.browserSyncReload);

  // Watch Datasets
  gulp
    .watch(
      './content/**/*.md',
      gulp.series(datasetPrepareSite, datasetPreparePages, buildPages)
    )
    .on('change', hotReload.browserSyncReload);

  // Watch GFX

  gulp.watch(config.gfxBase, gulp.series(images, hotReload.browserSyncRefresh));
}

// Gulp tasks
// --------------

gulp.task(
  'css',
  gulp.parallel(compileSassCore, compileSassCustom, compileSassUtils)
);

gulp.task('js', processJs);

gulp.task(
  'dataset',
  gulp.parallel(datasetPrepareSite, datasetPreparePages, datasetPrepareImages)
);

gulp.task(
  'html',
  gulp.series(datasetPrepareSite, datasetPreparePages, buildPages)
);

gulp.task('images', images);

gulp.task('fonts', fontLoad);

gulp.task('todo', todoFnc);

gulp.task(
  'serve',
  gulp.series(
    cleanFolders,
    images,
    copyStatic,
    datasetPrepareSite,
    datasetPreparePages,
    datasetPrepareNotes,
    datasetPrepareImages,
    datasetNotesAndImages,
    datasetNotesAndImagesBestOf,
    // fontLoad,
    compileSassCore,
    compileSassCustom,
    compileSassUtils,
    processJs,
    buildPages,
    todoFnc,
    gulp.parallel(watchFiles, hotReload.browserSync)
  )
);

// Aliases

gulp.task('watch', gulp.series('serve'));
gulp.task('default', gulp.series('serve'));
