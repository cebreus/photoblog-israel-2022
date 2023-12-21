const hbjs = require('handbrake-js');
const log = require('fancy-log');
const os = require('os');
const path = require('node:path');
const config = require('../gulpconfig');
const { fileExists } = require('./helpers');

require('dotenv').config();

// https://handbrake.fr/docs/en/latest/cli/command-line-reference.html
// https://trac.ffmpeg.org/wiki/Encode/H.264#Listpresetsandtunes

const FILES = [
  {
    input: 'content/PXL_20220806_123014373.mp4',
    params: {
      audio: 'none',
      maxWidth: 1080,
      maxHeight: 1920,
    },
  },
  {
    input: 'content/PXL_20220806_123035802.mp4',
    params: {
      audio: 'none',
      maxWidth: 1080,
      maxHeight: 1920,
    },
  },
  {
    input: 'content/PXL_20220808_103704419.mp4',
    params: {
      'start-at': 'seconds:2',
      maxWidth: 1280,
      maxHeight: 720,
    },
  },
  {
    input: 'content/PXL_20220808_141336372.mp4',
    params: {
      audio: 'none',
      maxWidth: 1280,
      maxHeight: 720,
    },
  },
  {
    input: 'content/PXL_20220808_155746363.mp4',
    params: {
      maxWidth: 1280,
      maxHeight: 720,
    },
  },
];

const DEFAULT_PARAMS = {
  format: 'av_mp4',
  optimize: true,
  'align-av': true,
  encoder: 'x264',
  'two-pass': true,
  turbo: true,
  'encoder-preset': 'fast',
  'encoder-tune': 'film',
  'encoder-profile': 'main',
  'encoder-level': '4.0',
  deblock: true,
  unsharp: 'medium',
  'unsharp-tune': 'medium',
  hqdn3d: 'strong',
};

function getFormattedName(input) {
  const { name, ext } = path.parse(input);
  const dateRegExp = /^\d{4}-\d{2}-\d{2}/;

  if (dateRegExp.test(name)) {
    return `${name}${ext}`;
  }

  const datePart = name.split('_')[1];
  const date = `${datePart.slice(0, 4)}-${datePart.slice(
    4,
    6,
  )}-${datePart.slice(6, 8)}`;
  const time = name.split('_')[2].slice(0, 6);

  return `${date}-${process.env.DATA_DIR.slice(0, -5)}-${time}-cebreus${ext}`;
}

const compileVideo = ({ input, params = {} }, { silent = false }) => {
  return new Promise((resolve, reject) => {
    if (!fileExists(input)) {
      // log(`Skipping non-existing file: ${input}`);
      resolve();
      return;
    }

    const output = `${config.staticBase}/assets/${
      process.env.DATA_DIR
    }/${getFormattedName(input)}`;

    const paramsAll = {
      ...DEFAULT_PARAMS,
      input,
      output,
      ...params,
    };

    hbjs
      .spawn(paramsAll)
      .on('start', () => {
        log(`Processing: ${input}`);
        log(`    > ${output}`);
        if (!silent) {
          log(paramsAll);
          log();
        }
      })
      .on('error', reject)
      .on('progress', (progress) => {
        if (!silent) {
          log(
            'Percent complete: %s, ETA: %s',
            progress.percentComplete,
            progress.eta,
          );
        }
      })
      .on('complete', () => {
        log(`DONE: ${output}\n`);
        resolve();
      });
  });
};

const processFiles = (files, mods) => {
  const batchSize = os.cpus().length / 2 < 8 ? 2 : os.cpus().length / 2;
  const fileChunks = [];
  let i = 0;
  while (i < files.length) {
    fileChunks.push(files.slice(i, i + batchSize));
    i += batchSize;
  }

  return fileChunks.reduce((promiseChain, currentBatch) => {
    return promiseChain.then(() =>
      Promise.all(
        currentBatch.map((file) => {
          return compileVideo(file, mods);
        }),
      ),
    );
  }, Promise.resolve());
};

const execute = () => {
  // return compileVideo(files[0], { silent: false }, () => {});
  return processFiles(FILES, { silent: true });
};

module.exports = {
  compileVideo,
  processFiles,
  execute,
};
