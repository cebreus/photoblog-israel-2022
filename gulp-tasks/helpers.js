const fs = require('fs');
const path = require('path');

/**
 * @description  Sort the array by date and time
 * @param {string} a Fisrt date
 * @param {string} b Second date
 * @returns {Array} Sorted array by date and time
 */

const sortByDate = (a, b) => {
  const dateA = new Date(a.date).getTime();
  const dateB = new Date(b.date).getTime();
  return dateA > dateB ? 1 : -1;
};

/**
 * @description  Group array by give key
 * @param {Array} array
 * @param {string} key
 * @returns {Array} Grouped array
 */

const groupBy = (array, key) => {
  // Return the end result
  return array.reduce((result, currentValue) => {
    // If an array already present for key, push it to the array. Else create an array and push the object
    (result[currentValue[key]] = result[currentValue[key]] || []).push(
      currentValue
    );
    // Return the current iteration `result` value, this will be taken as next iteration `result` value and accumulate
    return result;
  }, {}); // empty object is the initial value for result object
};

/**
 * @description Read files synchronously from a folder, with natural sorting
 * @param {string} dir Absolute path to directory
 * @returns {object[]} List of object, each object represent a file
 * structured like so: `{ filepath, name, ext, stat }`
 */

const readFilesSync = (dir) => {
  const files = [];

  fs.readdirSync(dir).forEach((filename) => {
    const { name } = path.parse(filename);
    const filepath = path.resolve(dir, filename);
    const stat = fs.statSync(filepath);
    const isFile = stat.isFile();

    if (isFile) files.push({ filepath, name, stat });
  });

  files.sort((a, b) => {
    // natural sort alphanumeric strings
    // https://stackoverflow.com/a/38641281
    return a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  return files;
};

/**
 * @description  Recursively create directory
 * @param {string} dir Directory or path
 */

const mkdirr = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true,
    });
  }
};

module.exports = {
  groupBy,
  mkdirr,
  readFilesSync,
  sortByDate,
};
