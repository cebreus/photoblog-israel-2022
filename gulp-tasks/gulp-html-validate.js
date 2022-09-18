const gulp = require('gulp');
const validate = require('gulp-html-validate');

const htmlValidate = (input) => {
  return (
    gulp
      .src(input)

      // Aaply the `html-validate` report to each file object, so these
      // can be used by other modules.
      .pipe(validate())

      // Output `html-validate` results to the console.
      .pipe(validate.format())

      // Make gulp to exit with an error code if any error(s) occurred.
      .pipe(validate.failAfterError())
  );
};

module.exports = htmlValidate;
