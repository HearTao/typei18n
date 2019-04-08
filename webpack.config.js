const path = require('path')
const merge = require('webpack-merge')

module.exports.lib = {
  mode: process.env.NODE_ENV || 'development',
  target: 'node',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'lib'),
    filename: 'index.js',
    library: 'typeI18n',
    libraryTarget: 'umd'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        resolve: {
          extensions: ['.ts', '.tsx', '.js']
        }
      }
    ]
  },
  externals: ['typescript', 'prettier']
}

module.exports.cli = merge(module.exports.lib, {
  entry: './src/cli.ts',
  output: {
    filename: 'cli.js',
    library: 'typeI18nCli',
    libraryTarget: 'commonjs2'
  },
  externals: ['typescript', 'yargs', 'prettier', 'get-stdin', 'chokidar', './']
})
