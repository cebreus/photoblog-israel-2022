const cwebp = require('gulp-cwebp');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const imagemin = require('gulp-imagemin');
const imageResize = require('gulp-image-resize');
const log = require('fancy-log');
const mozjpeg = require('imagemin-mozjpeg');
const newer = require('gulp-newer');
const plumber = require('gulp-plumber');
const upng = require('gulp-upng');

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

const details = (input, output, params = {}) => {
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

const previews = (input, output, params = {}) => {
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

const previewsXl = (input, output, params = {}) => {
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

const previewsXXS = (input, output, params = {}) => {
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
  if (params.verbose) {
    log(`    🟠 Start: ${output}`);
  }

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(upng({}))
    .pipe(gulp.dest(`${output}/details`))
    .pipe(
      imageResize({
        imageMagick: true,
        noProfile: true,
        width: 1296, // 1116 XL
        sharpen: '0.5x0.5+0.5+0.008',
      })
    )
    .pipe(gulp.dest(`${output}/maps-xl`))
    .pipe(
      imageResize({
        imageMagick: true,
        noProfile: true,
        width: 321,
        sharpen: '0.5x0.5+0.5+0.008',
      })
    )
    .pipe(gulp.dest(`${output}/maps-xxs`))
    .on('end', () => {
      if (params.verbose) {
        log(`    🟠 End: ${output}/maps-xl & /maps-xxs & /details`);
      }
      params.cb();
    });
};

const mapsWebp = (input, output, params = {}) => {
  if (params.verbose) {
    log(`  🟠🟠 Start: ${output}`);
  }

  return gulp
    .src(input)
    .pipe(plumber())
    .pipe(
      imageResize({
        imageMagick: true,
        noProfile: true,
        width: 1296, // 1116 XL
        sharpen: '0.5x0.5+0.5+0.008',
      })
    )
    .pipe(
      cwebp({
        q: 60,
        m: 6,
        mt: true,
      })
    )
    .pipe(gulp.dest(`${output}/maps-xl-webp`))
    .pipe(
      imageResize({
        imageMagick: true,
        noProfile: true,
        width: 321,
        sharpen: '0.5x0.5+0.5+0.008',
      })
    )
    .pipe(gulp.dest(`${output}/maps-xxs-webp`))
    .on('end', () => {
      if (params.verbose) {
        log(`  🟠🟠 End: ${output}/maps-xl-webp & ${output}/maps-xxs-webp`);
      }
      params.cb();
    });
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
