import React from 'react'
import ReactDOM from 'react-dom'
import ensureNode from 'util-extra/dom/ensureNode'
import useI18n, { I18nProvider } from '../useI18n'

function Root() {
  const [lang, setLang] = useI18n()

  return (
    <div style={{ padding: `5rem` }}>
      
      {[`en`, `zh`, `sp`].map((la, idx) => (
        <button key={idx} onClick={() => setLang(la as 'en' | 'zh' | 'sp')}>
          {la.toUpperCase()}
        </button>)
      )}
      
      <div style={{ margin: `2rem` }}>
        <div>{lang.dialog.ok}</div>
        <div>{lang.dialog.cancel}</div>
        <div>{lang.dialog.what}</div>
        <div>{lang.dialog.do(`233`, `foo`)}</div>
      </div>
    </div>
  )
}

ReactDOM.render((
  <I18nProvider>
    <Root />
  </I18nProvider>
), ensureNode(`app`))
