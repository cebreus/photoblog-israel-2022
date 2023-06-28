const { exec } = require('child_process');
const fs = require('fs');
const gulp = require('gulp');
const log = require('fancy-log');
const replace = require('gulp-replace');
const through2 = require('through2');
const todo = require('gulp-todo');

/**
 * @description A function to generate a TODO.md file
 * @param {object} params - The function parameters.
 * @returns {Stream} Compiled file
 */
const buildTodo = (params = {}) => {
  let todoExist = false;

  const filePath = './TODO.md';

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    log('         Existing TODO.md file deleted.');
  }

  return gulp
    .src(['**/*.{js,css,scss,md}', '!node_modules/**'])
    .pipe(todo())
    .pipe(replace('### ', '# '))
    .pipe(
      through2.obj(function processFile(file, _, cb) {
        if (file.todos?.length) {
          todoExist = true;
          this.push(file);
        }
        cb();
      })
    )
    .pipe(gulp.dest('./'))
    .on('end', async () => {
      if (!todoExist) {
        log('         No TODOs found.');
        params.cb?.();
        return;
      }

      try {
        await exec(
          `npx remark-cli -q ${filePath} -o -- && git add ${filePath}`
        );
        if (params.verbose) {
          log('         ToDos created.');
        }
      } catch (error) {
        console.error(`exec error: ${error}`);
      }
      params.cb?.();
    });
};

module.exports = buildTodo;
