const gulp = require('gulp')
const del = require('del')
const path = require('path')
const config = require('./webpack.config')
const webpack = require('webpack-stream')

gulp.task('clean', function() {
  return del([path.join(__dirname, './lib')])
})

gulp.task('build:lib', function() {
  return gulp
    .src(path.join(__dirname, './src'))
    .pipe(webpack(config.lib))
    .pipe(gulp.dest(path.join(__dirname, './lib')))
})

gulp.task('build:cli', function() {
  return gulp
    .src(path.join(__dirname, './src'))
    .pipe(webpack(config.cli))
    .pipe(gulp.dest(path.join(__dirname, './lib')))
})

gulp.task('build', gulp.parallel(['build:lib', 'build:cli']))

gulp.task('default', gulp.series(['build']))
