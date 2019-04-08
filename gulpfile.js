const gulp = require('gulp')
const del = require('del')
const path = require('path')
const fs = require('fs')
const config = require('./webpack.config')
const webpack = require('webpack-stream')
const through = require('through2')
const vinyl = require('vinyl')

function createI18nPipe(gen) {
  return through.obj(function(vinylFile, encoding, callback) {
    const files = fs.readdirSync(vinylFile.path).filter(x => path.extname(x) === '.yaml').map(x => path.join(vinylFile.path, x))
    const content = gen(files, 'provider')
    const file = new vinyl({
      path: './index.ts',
      contents: new Buffer(content)
    })

    callback(null, file)
  })
}

function createModuleI18nPipe() {
  return createI18nPipe(require('./node_modules/typei18n/lib/index').gen)
}

function createBuildI18nPipe() {
  return createI18nPipe(require('./lib/index').gen)
}

gulp.task('clean', function() {
  return del([path.join(__dirname, './lib')])
})

gulp.task('build:local', function() {
  return gulp
    .src(path.join(__dirname, './src/locales'))
    .pipe(createModuleI18nPipe())
    .pipe(gulp.dest(path.join(__dirname, './src/locales')))
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

gulp.task('build:bootstrapping', function () {
  return gulp
    .src(path.join(__dirname, './src/locales'))
    .pipe(createBuildI18nPipe())
    .pipe(gulp.dest(path.join(__dirname, './src/locales')))
})

gulp.task('build', gulp.parallel(['build:lib', 'build:cli']))

gulp.task('default', gulp.series(['build:local', 'build', 'build:bootstrapping', 'build']))
