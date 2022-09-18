const ftp = require('vinyl-ftp');
const gulp = require('gulp');
const log = require('fancy-log');
require('dotenv').config();

/**
 * @description Deploy files and folders to FTP
 * @param {string} input path to folder to deploy
 * @param {string} basePath input base path
 * @param {string} output destination path
 * @param {object} params
 * @returns {*} Compiled file
 */

const deployFtp = (input, basePath, output, params = {}) => {
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
      params.cb();
    });
};

module.exports = deployFtp;
