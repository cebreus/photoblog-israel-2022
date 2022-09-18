const autoprefixer = require('autoprefixer');

// Paths
// --------------

const devBase = './src';
const buildBase = './temp';
const tempBase = './temp';
const contentBase = './content';
const staticBase = './static';

// SASS
// --------------

const sassBase = `${devBase}/scss`;
const sassBuild = `${buildBase}/assets/css`;
const sassAll = [`${sassBase}/*.scss`, `!${sassBase}/_*.scss`];
// TODO: je potřeba _variables.scss?
const sassCustom = [
  `${sassBase}/*.scss`,
  `${sassBase}/_variables.scss`,
  `!${sassBase}/u-*.scss`,
  `!${sassBase}/bootstrap.scss`,
];
// TODO: je potřeba _variables.scss?
const sassCore = [`${sassBase}/bootstrap.scss`, `${sassBase}/_variables.scss`];
// TODO: je potřeba _variables.scss?
const sassUtils = [`${sassBase}/u-*.scss`, `${sassBase}/_variables.scss`];
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
];

const fontloadFile = `${devBase}/fonts.list`;
const fontLoadConfig = {
  fontsDir: 'assets/font/',
  cssDir: 'assets/css/',
  cssFilename: 'fonts.scss',
  relativePaths: true,
  fontDisplayType: 'swap',
};

// Exports
// --------------

module.exports = {
  buildBase,
  contentBase,
  datasetPagesBuild,
  datasetPagesSource,
  devBase,
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
  sassCore,
  sassCustom,
  sassUtils,
  staticBase,
  tempBase,
  tplBase,
  tplBuild,
  tplPagesBase,
  tplTemplatesBase,
};
