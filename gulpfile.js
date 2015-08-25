var gulp = require('gulp');
var coffee = require('gulp-coffee');

gulp.task('compile', function () {
  gulp.src('CoffeeSource/*.coffee')
      .pipe(coffee())
      .pipe(gulp.dest("CompiledJs"));
});

gulp.task('watch',function () {
  gulp.watch('CoffeeSource/*.coffee',['compile']);
});

gulp.task('default',['watch','compile']);
