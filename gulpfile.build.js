/* eslint-plugin-disable jsdoc */

const fs = require('fs');
const gulp = require('gulp');
const log = require('fancy-log');
const cleanFnc = require('./gulp-tasks/gulp-clean');
const config = require('./gulpconfig.build');
const copyStaticFnc = require('./gulp-tasks/gulp-copy-static');
const cssCompileFnc = require('./gulp-tasks-build/gulp-compile-sass');
const cssPurgeFnc = require('./gulp-tasks-build/gulp-purgecss');
const datasetBuildImagesFnc = require('./gulp-tasks/gulp-dataset-images');
const datasetPrepareFnc = require('./gulp-tasks/gulp-dataset-prepare');
const deployFtpFnc = require('./gulp-tasks/gulp-deploy-ftp');
const faviconsFnc = require('./gulp-tasks/gulp-favicons');
const fontLoadFnc = require('./gulp-tasks/gulp-font-load');
const htmlBuildFnc = require('./gulp-tasks-build/gulp-html-build');
const htmlValidateFnc = require('./gulp-tasks/gulp-html-validate');
const imagesOptimizeFnc = require('./gulp-tasks/gulp-optimize-images');
const imagesResize = require('./gulp-tasks/gulp-resize-images');
const jsProcessFnc = require('./gulp-tasks-build/gulp-process-js');
const replaceHashFnc = require('./gulp-tasks-build/gulp-sri-hash');
const revisionFnc = require('./gulp-tasks-build/gulp-revision');
require('dotenv').config();

// Variables
// --------------

const showLogs = false;

// Gulp functions
// --------------

function cleanFolders() {
  return cleanFnc([config.tempBase, config.buildBase]);
}

function copyStatic(done) {
  return copyStaticFnc(
    [
      `${config.staticBase}/*`,
      `${config.staticBase}/**/*`,
      `${config.staticBase}/.*/*`,
    ],
    './static',
    config.buildBase,
    {
      cb: () => {
        done();
      },
    }
  );
}

function htmlValidate() {
  return htmlValidateFnc(`${config.buildBase}/**/*.html`);
}

function deployFtp(done) {
  return deployFtpFnc(`${config.buildBase}/**`, `${config.buildBase}/`, '.', {
    cb: () => {
      done();
    },
  });
}

// SASS

function compileSassAll(done) {
  return cssCompileFnc(
    config.sassAll,
    config.sassBuild,
    'index.min.css',
    config.postcssPluginsBase,
    {
      cb: () => {
        done();
      },
    }
  );
}

function purgecss(done) {
  return cssPurgeFnc(
    [`${config.buildBase}/**/*index*.css`],
    [`${config.buildBase}/**/*.html`],
    config.buildBase,
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
    concatFiles: true,
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
    `${config.contentBase}/${process.env.DATA_DIR}*.jpg`,
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
  imagesResize.previewsXXS(
    `${config.contentBase}/${process.env.DATA_DIR}/*.jpg`,
    `${config.staticBase}/assets/${process.env.DATA_DIR}/previews-xxs`,
    params
  );
  done();
}

// Favicons

function favicons(done) {
  return faviconsFnc(
    config.faviconSourceFile,
    config.faviconBuild,
    {
      config: config.faviconGenConfig,
      verbose: showLogs,
      cb: () => {
        done();
      },
    },
    () => {
      // Move `favicon.ico` to project root
      fs.rename(
        `${config.faviconBuild}/favicon.ico`,
        `${config.buildBase}/favicon.ico`,
        (err) => {
          if (err) throw err;
        }
      );

      // Move `favicons.njk` and edit file content
      fs.readFileSync(
        `${config.faviconBuild}/favicons.njk`,
        'utf8',
        (err, data) => {
          if (err) throw err;

          // Remove link to moved `favicon.ico`
          const newValue = data.replace(/<link rel="shortcut icon[^>]*>/g, '');

          fs.writeFileSync(
            `${config.tplTemplatesBase}/partials/favicons.njk`,
            newValue,
            'utf8',
            (err2) => {
              if (err2) {
                throw err;
              } else {
                // log('Done!');

                try {
                  fs.unlinkSync(`${config.faviconBuild}/favicons.njk`);
                  // log('Removed!');
                } catch (err3) {
                  log.error(err3);
                }
              }
            }
          );
        }
      );
    }
  );
}

// Fonts

function fontLoad(done) {
  return fontLoadFnc(
    config.fontloadFile,
    config.tempBase,
    {
      config: config.fontLoadConfig,
      verbose: showLogs,
      cb: () => {
        done();
      },
    },
    () => {
      copyStaticFnc(
        `${config.tempBase}/assets/font/**/*`,
        `${config.tempBase}/assets/font`,
        `${config.buildBase}/assets/font`,
        {
          cb: () => {
            done();
          },
        }
      );
    }
  );
}

function replaceHash(done) {
  return replaceHashFnc(`${config.buildBase}/**/*.html`, config.buildBase, {
    cb: () => {
      done();
    },
  });
}

function revision(done) {
  const params = {
    inputRevision: [
      `${config.buildBase}/**/*.css`,
      `${config.buildBase}/**/*.js`,
    ],
    inputRewrite: `${config.buildBase}/**/*.html`,
    outputRevision: config.buildBase,
    outputRewrite: config.buildBase,
    ouputManifest: `${config.tempBase}/revision`,
    cb: () => {
      done();
    },
  };

  return revisionFnc(params);
}

function postbuild(done) {
  fs.unlink(`${config.buildBase}/assets/favicons/favicons.njk`, (err) => {
    if (err) {
      log.error(err);
    }
  });
  htmlValidate();
  done();
}

// Gulp tasks
// --------------

gulp.task('css', compileSassAll);

gulp.task('js', processJs);

gulp.task('dataset', gulp.parallel(datasetPrepareSite, datasetPreparePages));

gulp.task(
  'html',
  gulp.series(datasetPrepareSite, datasetPreparePages, buildPages)
);

gulp.task('images', images);

gulp.task('fonts', fontLoad);

gulp.task('validate', htmlValidate);

gulp.task(
  'build',
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
    favicons,
    // fontLoad,
    compileSassAll,
    processJs,
    buildPages,
    purgecss,
    revision,
    replaceHash,
    postbuild
  )
);

gulp.task('deployFtp', gulp.series('build', deployFtp));

// Aliases

gulp.task('default', gulp.series('build'));
