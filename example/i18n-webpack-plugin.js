const { sync: glob } = require('glob')
const { gen } = require('../lib/')
const fs = require('fs')
const path = require(`path`)

module.exports = class I18nPlugin {
  constructor({ locales, filePath, moduleName } = {}) {
    this.locales = locales
    this.filePath = filePath
    this.moduleName = moduleName
    this.cache = null
  }

  apply(compiler) {
    if(!fs.existsSync(this.filePath)) {
      this.generate()
    } else {
      this.cache = fs.readFileSync(this.filePath, `utf-8`)
    }

    const options = compiler.options
    const moduleMap = options.resolve && options.resolve.alias && options.resolve.alias[this.moduleName]
    if(!moduleMap) {
      compiler.options.resolve = compiler.options.resolve || {}
      compiler.options.resolve.alias = compiler.options.resolve.alias || {}
      compiler.options.resolve.alias[this.moduleName] = this.filePath
    } else if(moduleMap !== this.filePath) {
      throw new Error(`[I18nPlugin] alias.${this.moduleName} can't match ${this.filePath} `)
    }

    compiler.hooks.emit.tap(`I18nPlugin`, (compilation) => {
      const locales = glob(`./locales/**/*.yaml`).map(f => path.resolve(f))

      locales.forEach(file => {
        const filePath = path.resolve(file)
        if(compilation.fileDependencies.has(filePath)) return
        compilation.fileDependencies.add(filePath)
      })

      const ret = gen(locales, 'provider')
      if(ret === this.cache) return
      this.generate()
    })
  }

  generate() {
    const directory = path.dirname(this.filePath)
    fs.mkdirSync(directory, { recursive: true })
    const locales = glob(`${this.locales}/**/*.yaml`).map(f => path.resolve(f))
    const result = gen(locales, `provider`)
    fs.writeFileSync(this.filePath, result, 'utf-8')
    this.cache = result
  }
}
