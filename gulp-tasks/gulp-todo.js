const cp = require('child_process');
const gulp = require('gulp');
const gulpClean = require('gulp-clean');
const gulpif = require('gulp-if');
const replace = require('gulp-replace');
const todo = require('gulp-todo');

/**
 * @description Create list of TODOs and FIXMEs from source code
 * @returns {*} Compiled file
 */

const buildTodo = () => {
  // generate a todo.md from your javascript files
  return gulp
    .src(['*.js', '!(node_modules)**/*.js'])
    .pipe(todo())
    .pipe(replace('### ', '## '))
    .pipe(
      gulpif(
        (file) => {
          return file.todos && Boolean(file.todos.length);
        },
        gulp.dest('./'),
        gulpClean()
      )
    )
    .on('finish', () => {
      return cp.exec('npx remark-cli -q ./TODO.md -o -- && git add ./TODO.md');
    });
};

module.exports = buildTodo;
