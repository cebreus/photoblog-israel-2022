const cwebp = require('gulp-cwebp');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const imageResize = require('gulp-image-resize');
const log = require('fancy-log');
const mergeStream = require('merge-stream');
const newer = require('gulp-newer');
const plumber = require('gulp-plumber');
const upng = require('gulp-upng');
const { loadPlugin } = require('./helpers');

/**
 * @description Function for resizing and optimizing JPEG images
 * @param {string} input Path to JPEG files
 * @param {string} output Path to save files
 * @param {boolean} params.rewriteExisting Switcher for rewriting files
 * @returns {*} Optimized JPEG images
 */

const imageResizePreviews = {
  imageMagick: true,
  noProfile: true,
  width: 534,
  height: 300,
  crop: true,
  gravity: 'Center',
  sharpen: '0.5x0.5+0.5+0.008',
};

const imageResizePreviewsXl = {
  imageMagick: true,
  noProfile: true,
  width: 370,
  height: 208,
  crop: true,
  gravity: 'Center',
  sharpen: '0.5x0.5+0.5+0.008',
};

const imageResizePreviewsXXS = {
  imageMagick: true,
  noProfile: true,
  width: 335,
  height: 188,
  crop: true,
  gravity: 'Center',
  sharpen: '0.5x0.5+0.5+0.008',
};

const imageResizePreviewsMapsXl = {
  imageMagick: true,
  noProfile: true,
  width: 1296, // 1116 XL
  sharpen: '0.5x0.5+0.5+0.008',
};

const imageResizePreviewsMapsXxs = {
  imageMagick: true,
  noProfile: true,
  width: 321,
  sharpen: '0.5x0.5+0.5+0.008',
};

const details = async (input, output, params = {}) => {
  const imagemin = await loadPlugin('gulp-imagemin');
  const mozjpeg = await loadPlugin('imagemin-mozjpeg');

  const rewriteExisting = !!(
    params.rewriteExisting &&
    typeof params.rewriteExisting === 'boolean' &&
    params.rewriteExisting === true
  );

  if (params.verbose) {
    log(`    🟣 Start: ${output}`);
  }

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(gulpif(!rewriteExisting, newer(output)))
    .pipe(
      imageResize({
        imageMagick: true,
        noProfile: true,
        width: 1280,
        // sharpen: '0.5x0.5+0.5+0.008',
      })
    )
    .pipe(
      imagemin([
        mozjpeg({
          quality: 90,
          quantTable: 2,
          dcScanOpt: 2,
          tune: 'ms-ssim',
          dct: 'float',
        }),
      ])
    )
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`    🟣 End: ${output}`);
      }
      params.cb();
    });
};

const previews = async (input, output, params = {}) => {
  const imagemin = await loadPlugin('gulp-imagemin');
  const mozjpeg = await loadPlugin('imagemin-mozjpeg');

  const rewriteExisting = !!(
    params.rewriteExisting &&
    typeof params.rewriteExisting === 'boolean' &&
    params.rewriteExisting === true
  );

  if (params.verbose) {
    log(`  🟣🟣 Start: ${output}`);
  }

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(gulpif(!rewriteExisting, newer(output)))
    .pipe(imageResize(imageResizePreviews))
    .pipe(
      imagemin([
        mozjpeg({
          quality: 80,
          quantTable: 2,
          dcScanOpt: 2,
          tune: 'ms-ssim',
          dct: 'float',
        }),
      ])
    )
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`  🟣🟣 End: ${output}`);
      }
      params.cb();
    });
};

const previewsWebp = (input, output, params = {}) => {
  const rewriteExisting = !!(
    params.rewriteExisting &&
    typeof params.rewriteExisting === 'boolean' &&
    params.rewriteExisting === true
  );

  if (params.verbose) {
    log(`🟣🟣🟣 Start: ${output}`);
  }

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(
      gulpif(
        !rewriteExisting,
        newer({
          dest: output,
          ext: '.webp',
        })
      )
    )
    .pipe(imageResize(imageResizePreviews))
    .pipe(
      cwebp({
        q: 60,
        m: 6,
        mt: true,
      })
    )
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`🟣🟣🟣 End: ${output}`);
      }

      params.cb();
    });
};

const previewsXl = async (input, output, params = {}) => {
  const imagemin = await loadPlugin('gulp-imagemin');
  const mozjpeg = await loadPlugin('imagemin-mozjpeg');

  const rewriteExisting = !!(
    params.rewriteExisting &&
    typeof params.rewriteExisting === 'boolean' &&
    params.rewriteExisting === true
  );

  if (params.verbose) {
    log(`    🔵 Start: ${output}`);
  }

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(gulpif(!rewriteExisting, newer(output)))
    .pipe(imageResize(imageResizePreviewsXl))
    .pipe(
      imagemin([
        mozjpeg({
          quality: 80,
          quantTable: 2,
          dcScanOpt: 2,
          tune: 'ms-ssim',
          dct: 'float',
        }),
      ])
    )
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`    🔵 End: ${output}`);
      }
      params.cb();
    });
};

const previewsXlWebp = (input, output, params = {}) => {
  const rewriteExisting = !!(
    params.rewriteExisting &&
    typeof params.rewriteExisting === 'boolean' &&
    params.rewriteExisting === true
  );

  if (params.verbose) {
    log(`  🔵🔵 Start: ${output}`);
  }

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(
      gulpif(
        !rewriteExisting,
        newer({
          dest: output,
          ext: '.webp',
        })
      )
    )
    .pipe(imageResize(imageResizePreviewsXl))
    .pipe(
      cwebp({
        q: 60,
        m: 6,
        mt: true,
      })
    )
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`  🔵🔵 End: ${output}`);
      }
      params.cb();
    });
};

const previewsXXS = async (input, output, params = {}) => {
  const imagemin = await loadPlugin('gulp-imagemin');
  const mozjpeg = await loadPlugin('imagemin-mozjpeg');

  if (params.verbose) {
    log(`🔵🔵🔵 Start: ${output}`);
  }

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(imageResize(imageResizePreviewsXXS))
    .pipe(
      imagemin([
        mozjpeg({
          quality: 60,
          quantTable: 2,
          dcScanOpt: 2,
          tune: 'ms-ssim',
          dct: 'float',
        }),
      ])
    )
    .pipe(gulp.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`🔵🔵🔵 End: ${output}`);
      }
      params.cb();
    });
};

const maps = (input, output, params = {}) => {
  const outputDetail = `${output}/maps-details`;
  const outputXl = `${output}/maps-xl`;
  const outputXxs = `${output}/maps-xxs`;

  const rewriteExisting = !!(
    params.rewriteExisting &&
    typeof params.rewriteExisting === 'boolean' &&
    params.rewriteExisting === true
  );

  if (params.verbose) {
    log(`    🟠 Start: 'MAPS PNG'  ${output}`);
  }

  return mergeStream(
    gulp
      .src(input)
      .pipe(plumber())
      .pipe(gulpif(!rewriteExisting, newer(outputDetail)))
      .pipe(upng({}))
      .pipe(gulp.dest(outputDetail))
      .on('end', () => {
        if (params.verbose) {
          log(`    🟠 End: 'MAPS PNG'  ${outputDetail}`);
        }
        params.cb();
      }),

    gulp
      .src(input)
      .pipe(plumber())
      .pipe(gulpif(!rewriteExisting, newer(outputXl)))
      .pipe(imageResize(imageResizePreviewsMapsXl))
      .pipe(upng({}))
      .pipe(gulp.dest(outputXl))
      .on('end', () => {
        if (params.verbose) {
          log(`    🟠 End: 'MAPS PNG'  ${outputXl}`);
        }
        params.cb();
      }),

    gulp
      .src(input)
      .pipe(plumber())
      .pipe(gulpif(!rewriteExisting, newer(outputXxs)))
      .pipe(imageResize(imageResizePreviewsMapsXxs))
      .pipe(gulp.dest(`${outputXxs}`))
      .on('end', () => {
        if (params.verbose) {
          log(`    🟠 End: 'MAPS PNG'  ${outputXxs}`);
        }
        params.cb();
      })
  );
};

const mapsWebp = (input, output, params = {}) => {
  const outputXl = `${output}/maps-xl-webp`;
  const outputXxs = `${output}/maps-xxs-webp`;

  const rewriteExisting = !!(
    params.rewriteExisting &&
    typeof params.rewriteExisting === 'boolean' &&
    params.rewriteExisting === true
  );

  if (params.verbose) {
    log(`  🟠🟠 Start: 'MAPS WEBP' ${output}`);
  }

  return mergeStream(
    gulp
      .src(input)
      .pipe(plumber())
      .pipe(
        gulpif(
          !rewriteExisting,
          newer({
            dest: outputXl,
            ext: '.webp',
          })
        )
      )
      .pipe(imageResize(imageResizePreviewsMapsXl))
      .pipe(
        cwebp({
          q: 60,
          m: 6,
          mt: true,
        })
      )
      .pipe(gulp.dest(`${outputXl}`))
      .on('end', () => {
        if (params.verbose) {
          log(`  🟠🟠 End: 'MAPS WEBP' ${outputXl}`);
        }
        params.cb();
      }),

    gulp
      .src(input)
      .pipe(plumber())
      .pipe(
        gulpif(
          !rewriteExisting,
          newer({
            dest: outputXxs,
            ext: '.webp',
          })
        )
      )
      .pipe(imageResize(imageResizePreviewsMapsXxs))
      .pipe(gulp.dest(`${outputXxs}`))
      .on('end', () => {
        if (params.verbose) {
          log(`  🟠🟠 End: 'MAPS WEBP' ${outputXxs}`);
        }
        params.cb();
      })
  );
};

module.exports = {
  details,
  previews,
  previewsWebp,
  previewsXl,
  previewsXlWebp,
  previewsXXS,
  maps,
  mapsWebp,
};
