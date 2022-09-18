const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
require('dotenv').config();

// Paths
// --------------

const devBase = './src';
const buildBase = './build';
const tempBase = './temp';
const contentBase = './content';
const staticBase = './static';

// SASS
// --------------

const sassBase = `${devBase}/scss`;
const sassBuild = `${buildBase}/assets/css`;
const sassAll = [
  `${sassBase}/*.scss`,
  `!${sassBase}/_*.scss`,
  `!${sassBase}/u-*.scss`,
];
const injectCss = `${sassBuild}/*.css`;

// JavaScript
// --------------

const jsBase = `${devBase}/js`;
const jsFiles = `${jsBase}/*.js`;
const jsBuild = `${buildBase}/assets/js`;
const injectJs = `${jsBuild}/*.js`;

const injectCdnJs = [];

// Templates
// --------------

const tplBase = `${devBase}/templates`;
const tplBuild = buildBase;

const tplPagesBase = `${tplBase}/pages`;
const tplTemplatesBase = `${tplBase}`;

// Datasets from Markdown to JSON
// ----------------

const datasetPagesSource = `${contentBase}/pages/**/*.md`;
const datasetPagesBuild = `${tempBase}/_dataset-pages`;

// GFX
// --------------

const gfxBase = `${devBase}/gfx`;
const gfxBuild = `${buildBase}/assets/images`;

const jpgBase = `${gfxBase}/**`;
const imagesJpg = [`${jpgBase}/*.jpg`, `!${devBase}/favicon/**/*.*`];

const pngBase = `${gfxBase}/**`;
const imagesPng = [`${pngBase}/*.png`, `!${pngBase}/favicon/**/*.*`];

const svgBase = `${gfxBase}/**`;
const imagesSvg = [`${svgBase}/*.svg`, `!${devBase}/favicon/**/*.*`];

// Modules & Plugins
// --------------

const postcssPluginsBase = [
  autoprefixer({
    grid: true,
  }),
  cssnano(),
];

const fontloadFile = `${devBase}/fonts.list`;
const fontLoadConfig = {
  fontsDir: 'assets/font/',
  cssDir: 'assets/css/',
  cssFilename: 'fonts.scss',
  relativePaths: true,
  fontDisplayType: 'swap',
};

const faviconSourceFile = `${gfxBase}/favicon/favicons-source.png`;
const faviconBuild = `${buildBase}/assets/favicons`;
const faviconGenConfig = {
  appName: 'Fotky Skandinávie 2022',
  appShortName: 'Foto Skandinávie',
  appDescription: 'Fotografické střípky z výletu do Skandinávie.',
  developerName: 'Jaroslav Vrana',
  developerURL: `https://${process.env.SOURCE}.cebre.us/`,
  background: '#0a1d39',
  theme_color: '#fd7e14',
  path: '/assets/favicons/',
  url: `https://${process.env.SOURCE}.cebre.us/`,
  display: 'standalone',
  lang: 'cs',
  orientation: 'portrait-primary',
  scope: '/',
  start_url: '/index.html',
  version: 1.0,
  logging: false,
  html: 'favicons.njk',
  pipeHTML: true,
  replace: false,
  icons: {
    android: true,
    appleIcon: false,
    appleStartup: false,
    coast: false,
    favicons: true,
    firefox: false,
    windows: false,
    yandex: false,
  },
};

// Files that need to be removed
// --------------

const buildRevManifest = `${tempBase}/rev-manifest.json`;

// Exports
// --------------

module.exports = {
  buildBase,
  buildRevManifest,
  contentBase,
  datasetPagesBuild,
  datasetPagesSource,
  devBase,
  faviconBuild,
  faviconGenConfig,
  faviconSourceFile,
  fontLoadConfig,
  fontloadFile,
  gfxBase,
  gfxBuild,
  imagesJpg,
  imagesPng,
  imagesSvg,
  injectCdnJs,
  injectCss,
  injectJs,
  jsBuild,
  jsFiles,
  postcssPluginsBase,
  sassAll,
  sassBase,
  sassBuild,
  staticBase,
  tempBase,
  tplBase,
  tplBuild,
  tplPagesBase,
  tplTemplatesBase,
};
