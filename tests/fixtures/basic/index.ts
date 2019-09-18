export type Language = 'en' | 'sp' | 'zh'
export type RootType = {
  dialog: {
    ok: string
    cancel: string
    what: string
    do: (options: { what: string | number; name: string | number }) => string
    hehe: {
      a: string
      b: string
      c: string
    }
  }
}
export class I18nProvider {
  constructor(
    private maps: Record<Language, RootType>,
    private _lang: Language
  ) {}
  get lang() {
    return this._lang
  }
  public setLanguage(lang: Language) {
    this._lang = lang
  }
  public get t() {
    return this.maps[this.lang]
  }
}
const provider = new I18nProvider(
  {
    en: {
      dialog: {
        ok: 'ok',
        cancel: 'cancel',
        what: 'fucking',
        do: (options: { what: string | number; name: string | number }) =>
          ['what are you ', options.what, ' doing ', options.name, ' ?'].join(
            ''
          ),
        hehe: {
          a: '1',
          b: '2',
          c: '3'
        }
      }
    },
    sp: {
      dialog: {
        ok: 'ok',
        cancel: 'cancel',
        what: 'fucking',
        do: (options: { what: string | number; name: string | number }) =>
          ['what are you ', options.what, ' doing ', options.name, '?'].join(
            ''
          ),
        hehe: {
          a: '1',
          b: '2',
          c: '3'
        }
      }
    },
    zh: {
      dialog: {
        ok: '\u786E\u5B9A',
        cancel: '\u53D6\u6D88',
        what: '\u7279\u4E48',
        do: (options: { what: string | number; name: string | number }) =>
          [
            '\u4F60 ',
            options.what,
            ' \u5728\u5E72\u5565 ',
            options.name,
            '?'
          ].join(''),
        hehe: {
          a: '1',
          b: '2',
          c: '3'
        }
      }
    }
  } as Record<Language, RootType>,
  'en'
)
export default provider
