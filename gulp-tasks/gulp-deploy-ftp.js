const ftp = require('vinyl-ftp');
const gulp = require('gulp');
const log = require('fancy-log');
require('dotenv').config();

/**
 * @function deployFtp
 * @description Uploads files to a FTP server using Gulp and Vinyl FTP.
 * @param {string} input The glob or path of the local files to be uploaded.
 * @param {string} basePath Base directory path to be used for the input files.
 * @param {string} output The path on the FTP server where the files should be uploaded.
 * @param {object} [params={}] An optional parameters object.
 * @param {boolean} [params.verbose=false] If true, logs additional information.
 * @param {function} [params.cb=null] An optional callback function to be called when the upload is done.
 * @returns {stream.Transform} A Gulp stream which can be piped to other functions or tasks.
 */

const deployFtp = (input, basePath, output, params = {}) => {
  const cb = params.cb || (() => {});

  if (typeof cb !== 'function') {
    throw new Error('Callback in params should be of type function.');
  }

  const conn = ftp.create({
    host: process.env.FTP_HOST,
    user: process.env.FTP_USER,
    password: process.env.FTP_PASSWORD,
    parallel: 10,
    log,
  });

  return gulp
    .src(input, { basePath, buffer: false })
    .pipe(conn.newer(input))
    .pipe(conn.dest(output))
    .on('end', () => {
      if (params.verbose) {
        log(`         Done upload to FTP from '${input}' to '${output}'`);
      }
      cb();
    });
};

module.exports = deployFtp;
