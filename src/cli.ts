import * as fs from 'fs'
import * as path from 'path'
import * as yargs from 'yargs'
import * as getStdin from 'get-stdin'
import { gen, Target } from './'
import { highlight } from 'cardinal'

function handler(data?: string) {
  return function handler1(argv: yargs.Arguments): void {
    const input = argv['input'] as string
    const output = argv['output'] as string
    const color = argv['color'] as boolean
    const target = argv['target'] as Target

    try {
      const files = fs
        .readdirSync(input)
        .filter(x => x.endsWith('.yaml'))
        .map(x => path.join(input, x))

      const result: string = gen(files, target)

      if (!output) return console.log(color ? highlight(result) : result + '\n')

      const filepath: string = path.resolve(output)
      fs.writeFileSync(filepath, result, 'utf8')
      console.log(`Done at ${filepath}`)
    } catch (e) {
      throw new Error(e)
    }
  }
}

/** @internal */
export default function main(args: string[]) {
  getStdin().then(data => {
    const isReadData: boolean = '' !== data
    yargs
      .strict()
      .command({
        command: `$0 ${isReadData ? '' : '<input> '}[options]`,
        describe: 'Generate i18n files',
        handler: handler(isReadData ? data : undefined),
        builder: (yargs: yargs.Argv): yargs.Argv => {
          if (isReadData) return yargs
          return yargs.positional('input', {
            describe: 'input file path',
            type: 'string',
            normalize: true
          })
        }
      })

      .option('o', {
        alias: 'output',
        describe: 'Output directory',
        type: 'string',
        requiresArg: true
      })
      .option('color', {
        describe: 'colorful result when print on terminal',
        type: 'boolean',
        default: true
      })

      .option('t', {
        alias: 'target',
        describe: 'Output target',
        type: 'string',
        choices: [Target.resource, Target.provider],
        default: Target.provider
      })

      .version()
      .alias('v', 'version')
      .showHelpOnFail(true, 'Specify --help for available options')
      .help('h')
      .alias('h', 'help').argv
  })
}
