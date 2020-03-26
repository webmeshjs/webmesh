const fs = require('fs')
const path = require('path')

const React = require('react')
const { useState, useContext, useEffect } = require('react')
const { render, Box, Text, Static, useInput, useApp } = require('ink')
const Spinner = require('ink-spinner').default
const execa = require('execa')
const MDX = require('@mdx-js/runtime')
const { MDXProvider } = require('@mdx-js/react')
const unified = require('unified')
const remarkMdx = require('remark-mdx')
const remarkParse = require('remark-parse')
const remarkStringify = require('remark-stringify')
const mkdirp = require('mkdirp')

const { updatePluginConfig } = require('@webmesh/gatsby')

const recipePath = path.join(process.cwd(), 'src', 'recipes', 'theme-ui.mdx')
const recipeSrc = fs.readFileSync(recipePath, 'utf8')

const Div = props => <Box width={500} {...props} />

const components = {
  h1: ({ children }) => (
    <Div>
      <Text underline bold>
        {children}
      </Text>
    </Div>
  ),
  wrapper: ({ children }) => <Div>{children}</Div>,
  p: ({ children }) => (
    <Div>
      <Text>{children}</Text>
    </Div>
  ),
  inlineCode: ({ children }) => <Text>{children}</Text>,
  Config: () => null,
  InstallGatsbyPlugin: ({ name }) => {
    const { next } = useProvisioningContext()

    useEffect(() => {
      updatePluginConfig(name)
      next()
    })

    return (
      <Box>
        <Text> </Text>
        <Spinner />
        <Text> </Text>
        <Text>Adding {name} to gatsby-config.js</Text>
      </Box>
    )
  },
  InstallPackages: ({ packages }) => {
    const { next } = useProvisioningContext()
    const [out, setOut] = useState('')

    // const { stdout } = createAction({ type: 'installPackages', name: [], next })

    useEffect(() => {
      execa('yarn', ['add', '-W', ...packages])
        .stdout.on('data', line => {
          setOut([...out, line.toString('utf8')])
        })
        .on('end', () => {
          next()
        })
    }, [])

    return (
      <Box>
        <Text> </Text>
        <Spinner />
        <Text> </Text>
        <Text>{out}</Text>
      </Box>
    )
  },
  ShadowFile: () => {
    return <Text>Shadow!!!!</Text>
  },
  WriteFile: ({ content, path: filePath }) => {
    const { next } = useProvisioningContext()

    useEffect(() => {
      const fullPath = path.join(process.cwd(), filePath)
      const { dir } = path.parse(fullPath)
      mkdirp.sync(dir)
      fs.writeFileSync(fullPath, content)
      next()
    })

    return <Text>Writing {filePath}</Text>
  },
  MDXDefaultShortcode: ({ children }) => <Text>{children}</Text>
}

const u = unified()
  .use(remarkParse)
  .use(remarkStringify)
  .use(remarkMdx)

const ast = u.parse(recipeSrc)

const steps = []
let index = 0
ast.children.forEach(node => {
  if (node.type === 'thematicBreak') {
    index++
    return
  }

  steps[index] = steps[index] || []
  steps[index].push(node)
})

const asRoot = nodes => {
  return {
    type: 'root',
    children: nodes
  }
}

const stepsAsMDX = steps.map(nodes => {
  const stepAst = asRoot(nodes)
  return u.stringify(stepAst)
})

const ProvisioningContext = React.createContext({})
const useProvisioningContext = () => useContext(ProvisioningContext)

const Wrapper = ({ steps }) => {
  const [step, setStep] = useState(0)
  const { exit } = useApp()
  useInput((_, key) => {
    if (key.return && !steps[step]) {
      exit()
    } else if (key.return) {
      next()
    }
  })

  const next = () => setStep(step + 1)
  const previous = () => setStep(step - 1)

  const currentStep = steps[step]

  return (
    <ProvisioningContext.Provider
      value={{
        step,
        next,
        previous
      }}
    >
      <Static>
        {steps
          .filter((_, i) => step > i)
          .map((_, i) => {
            return <Text key={i}>Step {i + 1} completed!</Text>
          })}
      </Static>
      {currentStep ? (
        <Div>
          <MDX>{currentStep}</MDX>
        </Div>
      ) : (
        <Text>Click enter to close!</Text>
      )}
    </ProvisioningContext.Provider>
  )
}

const Recipe = () => {
  return (
    <MDXProvider components={components}>
      <Wrapper steps={stepsAsMDX} />
    </MDXProvider>
  )
}

render(<Recipe />)
