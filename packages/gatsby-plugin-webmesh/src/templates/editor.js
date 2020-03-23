import React, { useEffect, useState } from 'react'
import getQueryParam from 'get-query-param'

import useDebounce from '../use-debounce'
import CodeEditor from '../components/code-editor'

const Editor = ({ src: code, onChange }) => {
  return <CodeEditor code={code} onChange={onChange} />
}

export default () => {
  const [code, setCode] = useState(null)
  const [page, setPage] = useState(null)
  const debouncedCode = useDebounce(code)

  useEffect(() => {
    setPage(getQueryParam('recipe', window.location.href))
  })

  useEffect(() => {
    const initializeCode = async () => {
      const res = await fetch('/___recipes/src', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipe: page })
      })
      const srcCode = await res.text()
      setCode(srcCode)
    }

    if (page) {
      initializeCode()
    }
  }, [page])

  useEffect(() => {
    if (!debouncedCode) {
      return
    }

    fetch('/___recipes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: debouncedCode,
        recipe: page
      })
    })
  }, [debouncedCode, page])

  if (!code || !page) {
    return null
  }

  return (
    <Editor
      src={code}
      onChange={newCode => {
        setCode(newCode)
      }}
    />
  )
}
