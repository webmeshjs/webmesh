const fs = require('fs')
const path = require('path')

const React = require('react')
const { useState, useContext, useEffect, useMemo } = require('react')
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
const humanizeList = require('humanize-list')
const Queue = require('better-queue')

const { updatePluginConfig } = require('@webmesh/gatsby')

const recipePath = path.join(process.cwd(), 'src', 'recipes', 'theme-ui.mdx')
const recipeSrc = fs.readFileSync(recipePath, 'utf8')

const logs = []
let queue = new Queue(
  (action, cb) => {
    if (action.id === 'npm-package') {
      const cmd = execa('yarn', ['add', '-W', ...action.name.split(' ')])
      cmd.stderr.on('data', line => {
        // logs.push(line.toString('utf8'))
      })
      cmd.stdout
        .on('data', line => {
          // logs.push(line.toString('utf8'))
        })
        .on('end', () => {
          // logs.push('finished install friyay')
          cb()
        })
    }
  },
  {
    merge: (oldAction, newAction, cb) => {
      if (oldAction.id === 'npm-package') {
        oldAction.name += ' ' + newAction.name
        return cb(null, oldAction)
      }

      cb(null, newAction)
    }
  }
)

const Div = props => (
  <Box width={80} textWrap="wrap" flexDirection="column" {...props} />
)

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
  Config: () => {
    const { next, lastKey } = useProvisioningContext()

    if (lastKey.return) {
      next(`Applying changes`)
    }

    return (
      <Div>
        <Text>Press enter to continue!</Text>
      </Div>
    )
  },
  GatsbyPlugin: ({ name }) => {
    const { next } = useProvisioningContext()

    useEffect(() => {
      updatePluginConfig(name)
      next(`Configured ${name}`)
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
  NPMPackage: ({ name }) => {
    const { queue } = useProvisioningContext()

    queue.push({ id: 'npm-package', name })

    return (
      <Box>
        <Text> </Text>
        <Spinner />
        <Text> </Text>
        <Text>{name}</Text>
      </Box>
    )
  },
  ShadowFile: ({ theme, path: filePath }) => {
    const { next } = useProvisioningContext()

    useEffect(() => {
      const relativePathInTheme = filePath.replace(theme + '/', '')
      const fullFilePathToShadow = path.join(
        process.cwd(),
        'node_modules',
        theme,
        relativePathInTheme
      )
      const fullPath = path.join(process.cwd(), filePath)
      const { dir } = path.parse(fullPath)
      mkdirp.sync(dir)
      const contents = fs.readFileSync(fullFilePathToShadow, 'utf8')
      fs.writeFileSync(fullPath, contents)
      next(`Successfully shadowed ${filePath} in ${theme}`)
    })

    return <Text>Shadowing {filePath}</Text>
  },
  File: ({ content, path: filePath }) => {
    const { next } = useProvisioningContext()

    useEffect(() => {
      const fullPath = path.join(process.cwd(), filePath)
      const { dir } = path.parse(fullPath)
      mkdirp.sync(dir)
      fs.writeFileSync(fullPath, content)
      next(`Wrote ${filePath}`)
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

const Wrapper = ({ steps: stepComponents }) => {
  const [steps, setSteps] = useState({
    step: 0,
    summaries: [],
    lastKey: {},
    actions: []
  })
  const { exit } = useApp()
  useInput((_, key) => {
    if (key.return && !stepComponents[steps.step + 1]) {
      exit()
    } else if (steps.step === stepComponents.length) {
      exit()
    } else if (key.return) {
      setSteps({
        ...steps,
        lastKey: key
      })
    }
  })

  useEffect(() => {
    logs.push('REMOUNTED')
  }, [])

  useEffect(() => {
    if (queue) {
      queue.resume()
    }
  }, [steps])

  // TODO: Use queue finished tasks as the array for summaries
  //       Convert other components to use actions
  //       Make actions standalone, tested functions
  //       Providers architecture to pass in actions with types and their executors

  useEffect(() => {
    queue.on('drain', () => {
      next(`did stuff`)
    })
  }, [steps])

  const next = stepSummary => {
    const newSteps = {
      ...steps,
      lastKey: {},
      step: steps.step + 1
    }

    if (stepSummary) {
      newSteps.summaries = [...steps.summaries, stepSummary]
    }

    setSteps(newSteps)
  }

  if (queue) {
    queue.pause()
  }

  const currentStep = useMemo(() => stepComponents[steps.step], [steps])

  return (
    <ProvisioningContext.Provider
      value={{
        ...steps,
        queue,
        next
      }}
    >
      <Static>{null && logs.map((l, i) => <Text key={i}>{l}</Text>)}</Static>
      {steps.summaries.map((stepSummary, i) => {
        return <Text key={i}>✅ {stepSummary}</Text>
      })}
      <Div>
        <MDX>{currentStep}</MDX>
      </Div>
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
