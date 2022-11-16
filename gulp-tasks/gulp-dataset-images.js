const exifr = require('exifr');
const fs = require('fs');
const log = require('fancy-log');
const path = require('node:path');
const probe = require('probe-image-size');
const { groupBy, mkdirr, sortByDate } = require('./helpers');

// [1] Get all JPGs

const readDirAndFilter = async (inputDir, inputExtMask, params = {}) => {
  const files = fs
    .readdirSync(inputDir)
    .filter((file) => file.match(new RegExp(`.*.(${inputExtMask})`, 'ig')))
    .map((fileName) => `${inputDir}/${fileName}`);

  if (params.verbose) {
    log('🟢 FCE [1] Get all JPGs');
    log.info(
      `   🟢 Loaded ${files.length} files '*{.${inputExtMask}}' from '${inputDir}'`
    );
  }
  if (params.verbose && params.verbose !== 'brief') {
    log(`   🟢 inputDir:     ${inputDir}`);
    log(`   🟢 inputExtMask: ${inputExtMask}`);
    log(`   🟢 params:       ${JSON.stringify(params)}`);
    log(`   🟢 RETURN:       ${files}\n`);
  }

  return files;
};

// [3] Filter metadata and create new object

const filterData = async (inputFile, allMetadata, params = {}) => {
  const metadata = {};
  const fileContent = fs.readFileSync(inputFile);
  const { width } = probe.sync(fileContent);
  const { height } = probe.sync(fileContent);
  metadata.kind = 'image';
  metadata.fileName = path.basename(inputFile);
  metadata.date = allMetadata.CreateDate.toISOString();
  metadata.groupBy = allMetadata.CreateDate.toISOString().substring(0, 10);
  // metadata.urgency = allMetadata.Urgency || '';
  metadata.keywords = allMetadata.Keywords || '';
  if (path.basename(inputFile).includes('.pano')) {
    metadata.type = 'pano';
  } else if (width > height) {
    metadata.type = 'landscape';
  } else if (width < height) {
    metadata.type = 'portrait';
  }
  metadata.ratio = (width / height).toFixed(2);
  metadata.width = width;
  metadata.height = height;
  // `ObjectName` can't be used because err in utf-8 encoding
  metadata.objectName = allMetadata.Headline || '';
  metadata.caption = allMetadata.Caption || '';
  metadata.location = allMetadata.Location || '';
  if (allMetadata.Headline) {
    metadata.where = allMetadata.Headline;
  } else if (allMetadata.Location) {
    metadata.where = allMetadata.Location;
  } else if (allMetadata.Sublocation) {
    metadata.where = allMetadata.Sublocation;
  } else {
    metadata.where = '';
  }
  metadata.city = allMetadata.City || '';
  metadata.country = allMetadata.Country || '';
  // metadata.fullStructure = allMetadata;

  if (params.verbose && params.verbose !== 'brief') {
    log('🟣 FCE [4] Filter metadata and create new object');
    log(`   🟣 inputFile:   ${inputFile}`);
    log(`   🟣 params:      ${JSON.stringify(params)}`);
    log(`   🟣 allMetadata: ${JSON.stringify(allMetadata).slice(0, 80)}`);
    log(`   🟣 metadata:    ${JSON.stringify(metadata).slice(0, 80)}`);
  }

  return metadata;
};

// [4] Save filtered data in JSON, per JPG

const saveFilteredData = async (metadata, outputDir, params = {}) => {
  if (params.verbose && params.verbose !== 'brief') {
    log('🟤 FCE [5] Save filtered data in JSON, per JPG');
    log(`   🟤 outputDir:   ${outputDir}`);
    log(`   🟤 params:      ${JSON.stringify(params)}`);
    log(`   🟤 metadata:    ${JSON.stringify(metadata)}\n`);
  }

  if (metadata) {
    mkdirr(outputDir);

    // let dateHelper = metadata.date.toISOString();
    const dateHelper = metadata.date;
    const outputJson = `${outputDir}/${dateHelper.substring(
      0,
      10
    )}-${dateHelper.substring(11, 13)}${dateHelper.substring(
      14,
      16
    )}${dateHelper.substring(17, 19)}.json`;

    fs.writeFileSync(outputJson, JSON.stringify(metadata), 'utf8', (err) => {
      if (err) {
        return log(err);
      }
      if (params.verbose) {
        log(`   🟤 File ${outputJson} is written`);
      }
      return params.cb();
    });
  } else log.error('   🟤 Missing metadata');
};

// [2] Extract EXIF from images

const extractData = async (inputJpegs, params = {}) => {
  if (params.verbose && params.verbose !== 'brief') {
    log('🔵 FCE [3] Extract EXIF from image');
    log(`   🔵 inputJpegs:  ${JSON.stringify(inputJpegs)}`);
    log(`   🔵 params:      ${JSON.stringify(params)}`);
  }

  try {
    const allMetadata = await exifr.parse(inputJpegs, params.extractParams);
    // [3] Filter metadata and create new object
    const metadata = await filterData(inputJpegs, allMetadata, params);
    // [4] Save filtered data in JSON, per JPG
    const save = await saveFilteredData(metadata, params.jsonDir, params);
    return save;
  } catch (err) {
    log.error(`   🔵 ${err.message}`);
  }
  return params.cb();
};

const extractAllData = async (inputJpegs, params = {}) => {
  if (params.verbose) {
    log('🟡 FCE [2] Extract all EXIF from images');
    log.info(`   🟡 Loaded ${inputJpegs.length} files`);
  }
  if (params.verbose && params.verbose !== 'brief') {
    log(`   🟡 params:      ${JSON.stringify(params)}`);
    log(`   🟡 inputJpegs:  ${JSON.stringify(inputJpegs)}\n`);
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const jpeg of inputJpegs) {
    // eslint-disable-next-line no-await-in-loop
    await extractData(jpeg, params);
  }

  // await Object.values(inputJpegs).forEach((jpeg) => extractData(jpeg, params));
};

// [5] Load all JSON, sort, group, merge and save one JSON

const mergeFilteredDataAndSave = async (inputDir, outputFile, params = {}) => {
  if (params.verbose) {
    log('🟩 FCE [6] Load all JSON, sort, group, merge and save one JSON');
  }

  const fileExt = 'json';
  let data = [];
  let dataCurrent = '';

  const files = fs
    .readdirSync(inputDir)
    .filter((file) => file.match(new RegExp(`.*.(${fileExt})`, 'ig')))
    .map((fileName) => `${inputDir}/${fileName}`);

  if (files.length === 0) {
    if (params.verbose) {
      log.error(`   🟩 No '*.${fileExt}' in directory '${inputDir}'`);
    }
  } else if (params.verbose) {
    log.info(
      `   🟩 Loaded ${files.length} files '*.${fileExt}' from '${inputDir}'`
    );
  }

  files.forEach((val) => {
    dataCurrent = JSON.parse(fs.readFileSync(val, 'utf8'));
    data.push(dataCurrent);
  });

  data.sort(sortByDate);
  data = groupBy(data, 'groupBy');

  return fs.writeFileSync(outputFile, JSON.stringify(data), 'utf8', (err) => {
    if (err) {
      return log.error(err);
    }
    if (params.verbose) {
      log(`   🟩 File ${outputFile} is written\n\n`);
    }
    return params.cb();
  });
};

/**
 * @description Generate JSON with customized data from images metadata
 * @param {Array} params Object with presets
 */
async function datasetBuildImages(params) {
  const jpegs = await readDirAndFilter(
    params.inputDir,
    params.inputExtMask,
    params
  );

  await extractAllData(jpegs, params);

  const mergeSave = await mergeFilteredDataAndSave(
    params.jsonDir,
    params.outputJson,
    params
  );

  return mergeSave;
}

// Proposed update for [5] mergeFilteredDataAndSave() by Emca

// const emca = () => {
//   const getUniqueByKey = (key, items) => {
//     // hint use map and then filter :)
//     return ['a', 'b'];
//   };

//   const getGroupByKey = (key, items) => {
//     const res = {};
//     const uniqueNames = getUniqueByKey(key, items);
//     for (const name of uniqueNames) {
//       // filter items by name => you should get items only with "a" for example
//       // then just res[name] = {
//       //  count: filteredItems.length,
//       //  items: filteredItems
//       // }
//     }
//     return res;
//   };

//   const getTransformedData = (data) => {
//     const res = {};

//     // loop through date keys "2022-08-04"
//     for (const key in data) {
//       res[key] = {
//         count: data[key].length,
//         uniquesNames: getUniqueByKey('name', data[key]),
//         groupByName: getGroupByKey('name', data[key]),
//       };
//     }
//     return res;
//   };

//   const res = getTransformedData(data);
//   console.log({ res });
// };

module.exports = datasetBuildImages;
