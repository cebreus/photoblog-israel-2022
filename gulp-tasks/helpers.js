const fs = require('fs');
const log = require('fancy-log');
const path = require('path');

/**
 * @function sortByDate
 * @description  Sort the array by date and time
 * @param {Object} a First object containing a date
 * @param {Object} b Second object containing a date
 * @returns {Array} Sorted array by date and time
 */

const sortByDate = (a, b) => {
  const dateA = new Date(a.date).getTime();
  const dateB = new Date(b.date).getTime();
  return dateA > dateB ? 1 : -1;
};

/**
 * @function groupBy
 * @description  Group array by given key
 * @param {Array} array The array to group
 * @param {string} key The key to group by
 * @returns {Array} Grouped array
 */

const groupBy = (array, key) => {
  // Return the end result
  return array.reduce((result, currentValue) => {
    // If an array already present for key, push it to the array. Else create an array and push the object
    (result[currentValue[key]] = result[currentValue[key]] || []).push(
      currentValue,
    );
    // Return the current iteration `result` value, this will be taken as next iteration `result` value and accumulate
    return result;
  }, {}); // empty object is the initial value for result object
};

/**
 * @function readFilesSync
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
 * @function mkdirr
 * @description  Recursively create directory
 * @param {string} dir Directory or path
 * @returns {void}
 */

const mkdirr = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true,
    });
  }
};

/**
 * @function loadPlugin
 * @description Load a plugin dynamically.
 * @param {string} plugin Name of the plugin to load.
 * @returns {*} The loaded plugin module.
 * @throws {Error} If the plugin fails to load.
 */

async function loadPlugin(plugin) {
  try {
    const module = await import(plugin);
    return module.default || module;
  } catch (error) {
    log.error(`Failed to load plugin: ${plugin}`);
    throw error;
  }
}

/**
 * @function readJson
 * @description Reads a file and parses its content as JSON.
 * @param {string} filePath
 * @returns {Object} Parsed JSON content of the file.
 */

const readJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));
  } catch (error) {
    log.error(`Error loading JSON data from ${filePath}`);
    throw error;
  }
};

/**
 * @function fileExists
 * @description Checks if a file exists.
 * @param {string} filePath
 * @returns {boolean} Whether the file exists or not.
 */

const fileExists = (filePath) => {
  try {
    fs.accessSync(filePath);
    return true;
  } catch (error) {
    log.error(`File ${filePath} doesn't exist.`);
    return false;
  }
};

/**
 * @function loadEnvVariables
 * @description Loads environment variables and returns an object with the variable names and their values.
 * @param {string[]} requiredVariables - An array of required environment variable names.
 * @returns {Object} - An object containing the loaded environment variables.
 * @throws {Error} - If any required environment variable is not set.
 */

const loadEnvVariables = (requiredVariables) => {
  const envVariables = {};

  requiredVariables.forEach((variable) => {
    const value = process.env[variable];
    if (!value) {
      throw new Error(`Environment variable ${variable} is not set`);
    }
    envVariables[variable] = value;
  });

  return envVariables;
};

module.exports = {
  fileExists,
  groupBy,
  loadEnvVariables,
  loadPlugin,
  mkdirr,
  readFilesSync,
  readJson,
  sortByDate,
};
