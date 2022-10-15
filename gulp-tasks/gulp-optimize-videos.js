const async = require('async');
const hbjs = require('handbrake-js');
const log = require('fancy-log');
const os = require('os');
const path = require('node:path');
const config = require('../gulpconfig');
require('dotenv').config();

const files = [
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

// https://handbrake.fr/docs/en/latest/cli/command-line-reference.html
// https://trac.ffmpeg.org/wiki/Encode/H.264#Listpresetsandtunes

const compileVideo = (data, mods, done) => {
  const { name } = path.parse(data.input);
  const date = `${name.split('_')[1].slice(0, 4)}-${name
    .split('_')[1]
    .slice(4, 6)}-${name.split('_')[1].slice(6, 8)}`;
  const time = name.split('_')[2].slice(0, 6);
  const output = `${config.staticBase}/assets/${
    process.env.DATA_DIR
  }/${date}-${process.env.DATA_DIR.slice(0, -5)}-${time}-cebreus.mp4`;

  const params = data.params || {};
  const generalParams = {};

  const sourceParams = {
    input: data.input,
  };

  const destinationParams = {
    output,
    format: 'av_mp4',
    optimize: true,
    'align-av': true,
  };

  const videoParams = {
    encoder: 'x264',
    'two-pass': true,
    turbo: true,
    'encoder-preset': 'fast',
    'encoder-tune': 'film', // fastdecode, film
    'encoder-profile': 'main', // baseline, main, high
    'encoder-level': '4.0', // baseline, main, high
    // quality: 22,
  };

  const audioParams = {
    // aencoder: 'copy:mp3',
    // 'audio-fallback': 'mp3',
    // ab: 128,
    // arate: 'auto',
    // 'normalize-mix': 1,
    // mixdown: 'stereo',
  };

  const pictureParams = {};

  const filtersParams = {
    deblock: true,
    unsharp: 'medium', // ultralight, light, medium, strong, stronger, verystrong, Default: y-strength=0.25:y-size=7:cb-strength=0.25:cb-size=7
    'unsharp-tune': 'medium', // none, ultrafine, fine, medium, coarse, verycoarse
    hqdn3d: 'strong', // new deoise; ultralight, light, medium, strong}
  };

  const subtitlesParams = {};

  const paramsAll = {
    ...generalParams,
    ...sourceParams,
    ...destinationParams,
    ...videoParams,
    ...audioParams,
    ...pictureParams,
    ...filtersParams,
    ...subtitlesParams,
    ...params,
  };

  hbjs
    .spawn(paramsAll)
    .on('start', () => {
      log(`FILE: ${data.input}`);
      log(`    > ${output}`);
      if (!mods.silent) {
        log(paramsAll);
        log();
      }
    })
    .on('error', (err) => {
      // invalid user input, no video found etc
      log(err);
    })

    .on('progress', (progress) => {
      if (!mods.silent) {
        log(
          'Percent complete: %s, ETA: %s',
          progress.percentComplete,
          progress.eta
        );
      }
    })
    .on('complete', () => {
      log(`DONE: ${output}\n`);
      done();
    });
};

const processFiles = (data, mods, done) => {
  const dataArray = [];
  const batchSize = os.cpus().length / 2 < 8 ? 2 : os.cpus().length / 2;
  const filesSum = data.length;
  for (let i = 0; i < filesSum; i += batchSize) {
    dataArray.push(data.slice(i, i + batchSize));
  }
  // log(data);

  async.eachSeries(
    data,
    (filesBatch, done1) => {
      compileVideo(filesBatch, mods, () => {
        done1();
      });
    },
    () => {
      done();
    }
  );
};

const execute = () => {
  // compileVideo(files[0], { silent: false }, () => {});
  processFiles(files, { silent: true }, () => {});
};

module.exports = {
  compileVideo,
  processFiles,
  execute,
};
