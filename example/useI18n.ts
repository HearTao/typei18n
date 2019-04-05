import { createElement, createContext, ReactChild, Children, useContext, useState } from 'react'
import i18n, { RootType } from 'i18n'

interface Context {
    lang: string
    setLanguage(lang: 'en' | 'zh' | 'sp'): void
}

export const I18nContext = createContext<Context>({
    lang: ``,
    setLanguage() { }
})

interface Props {
    language: `en` | `zh` | `sp`
    children: ReactChild
}

export function I18nProvider({ language = 'en', children }: Partial<Props> = {}) {
    const [ lang, setLang ] = useState(language)
    function setLanguage(lang: 'en' | 'zh' | 'sp'): void { 
        setLang(lang)
        i18n.lang = lang
    }
    return createElement(
        I18nContext.Provider, 
        { value: { lang, setLanguage } },
        Children.only(children)
    )
}

export default function useI18n(): [ RootType, (lang: 'en' | 'zh' | 'sp') => void ] {
    const context = useContext(I18nContext)
    return [ i18n.t, context.setLanguage ]
}
