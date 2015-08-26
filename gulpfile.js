var gulp = require('gulp');
var coffee = require('gulp-coffee');
var paths = ['CoffeeSource/**/*.coffee'];

gulp.task('compile', function () {
  gulp.src(paths)
      .pipe(coffee())
      .pipe(gulp.dest("CompiledJs"));
});

gulp.task('watch',function () {
  gulp.watch(paths,['compile']);
});

gulp.task('default',['watch','compile']);
