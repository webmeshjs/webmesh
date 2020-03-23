/** @jsx jsx */
import { jsx } from 'theme-ui'
import { useRef } from 'react'
import Monaco from '@monaco-editor/react'
import MDX from '@mdx-js/runtime'

const components = {
  InstallPackages: ({ packages = [] }) => (
    <pre>yarn add {packages.join(' ')}</pre>
  ),
  Config: ({ name }) => <pre>gatsby recipe {name}</pre>,
  InstallGatsbyPlugin: ({ name }) => (
    <pre>
      {`// gatsby-config.js
module.exports = {
  plugins: [
    // ...
+   '${name}',
  ]
}`}
    </pre>
  ),
  ShadowFile: ({ theme, path }) => (
    <div>
      <pre>
        {`gatsby shadow \\
  ${theme} \\
  ${path}`}
      </pre>
    </div>
  )
}

export default ({ code, onChange }) => {
  const editorRef = useRef(null)
  let renderedEl = null

  try {
    renderedEl = <MDX components={components}>{code}</MDX>
  } catch (e) {
    console.error(e)
  }

  const handleEditorDidMount = (_, editor) => {
    editorRef.current = editor

    editorRef.current.onDidChangeModelContent(ev => {
      onChange(editorRef.current.getValue())
    })
  }

  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      <div sx={{ width: '60%' }}>
        <Monaco
          height="100vh"
          value={code}
          language="markdown"
          editorDidMount={handleEditorDidMount}
          theme="light"
          options={{
            minimap: {
              enabled: false
            },
            scrollbar: {
              vertical: 'hidden'
            }
          }}
        />
      </div>
      <div sx={{ width: '40%' }}>{renderedEl}</div>
    </div>
  )
}
