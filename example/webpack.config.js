const path = require(`path`)
const HtmlWebpackPlugin = require('html-webpack-plugin')
const I18nWebpackPlugin = require('./i18n-webpack-plugin')




module.exports = {
    mode: `none`,
    entry: `./src/index.tsx`,
    target: `web`,
    resolve: {
        extensions: [`.js`, `.ts`, `.json`, `.mjs`]
    },
    module: {
        rules: [
        {
            test: /\.tsx?$/,
            use: `ts-loader`
        }]
    },
    plugins: [
        new I18nWebpackPlugin({
          locales: path.resolve(`./locales`),
          filePath: path.resolve(`./types/locales/index.ts`),
          moduleName: `i18n`
        }),
        new HtmlWebpackPlugin()
    ]
}

