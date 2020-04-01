const fs = require('fs')
const path = require('path')

const React = require('react')
const { useState, useContext, useEffect } = require('react')
const { render, Box, Text, useInput, useApp } = require('ink')
const Spinner = require('ink-spinner').default
const unified = require('unified')
const remarkMdx = require('remark-mdx')
const remarkParse = require('remark-parse')
const remarkStringify = require('remark-stringify')
const jsxToJson = require('simplified-jsx-to-json')
const visit = require('unist-util-visit')
const humanizeList = require('humanize-list')
const {
  createClient,
  useMutation,
  useSubscription,
  Provider,
  defaultExchanges,
  subscriptionExchange
} = require('urql')
const { SubscriptionClient } = require('subscriptions-transport-ws')
const fetch = require('node-fetch')
const ws = require('ws')

const recipePath = path.join(process.cwd(), 'src', 'recipes', 'jest.mdx')
const recipeSrc = fs.readFileSync(recipePath, 'utf8')

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'

const subscriptionClient = new SubscriptionClient(
  'ws://localhost:4000/graphql',
  {
    reconnect: true
  },
  ws
)

const client = createClient({
  fetch,
  url: GRAPHQL_ENDPOINT,
  exchanges: [
    ...defaultExchanges,
    subscriptionExchange({
      forwardSubscription(operation) {
        return subscriptionClient.request(operation)
      }
    })
  ]
})

const Div = props => {
  return <Box width={80} textWrap="wrap" flexDirection="column" {...props} />
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

const toJson = value => {
  const obj = {}
  jsxToJson(value).forEach(([type, props = {}]) => {
    if (type === '\n') {
      return
    }
    obj[type] = obj[type] || []
    obj[type].push(props)
  })
  return obj
}

const allCommands = steps
  .map(nodes => {
    const stepAst = asRoot(nodes)
    let cmds = []
    visit(stepAst, 'jsx', node => {
      const jsx = node.value
      cmds = cmds.concat(toJson(jsx))
    })
    return cmds
  })
  .reduce((acc, curr) => {
    const cmdByName = {}
    curr.map(v => {
      Object.entries(v).forEach(([key, value]) => {
        cmdByName[key] = cmdByName[key] || []
        cmdByName[key] = cmdByName[key].concat(value)
      })
    })
    return [...acc, cmdByName]
  }, [])

const RecipeInterpreter = ({ commands }) => {
  const [lastKeyPress, setLastKeyPress] = useState(``)
  const { exit } = useApp()
  const [subscriptionResponse] = useSubscription(
    {
      query: `
        subscription {
          operation {
            state
            data
          }
        }
      `
    },
    (_prev, now) => {
      return now
    }
  )
  const [_, createOperation] = useMutation(`
    mutation ($commands: String!) {
      createOperation(commands: $commands)
    }
  `)

  subscriptionClient.connectionCallback = () => {
    createOperation({ commands: JSON.stringify(commands) })
  }

  const { data } = subscriptionResponse
  const operation =
    (data &&
      data.operation &&
      data.operation.data &&
      JSON.parse(data.operation.data)) ||
    commands

  const state = data && data.operation && data.operation.state

  useInput((_, key) => {
    setLastKeyPress(key)
    if (key.return && state === 'SUCCESS') {
      subscriptionClient.close()
      exit()
    }
  })

  return (
    <>
      <Div>
        {process.env.DEBUG ? (
          <Text>{JSON.stringify(subscriptionResponse)}</Text>
        ) : null}
      </Div>
      <Div>
        {process.env.DEBUG ? (
          <Text>Last Key Press: {JSON.stringify(lastKeyPress, null, 4)}</Text>
        ) : null}
      </Div>
      <Div>{process.env.DEBUG ? <Text>STATE: {state}</Text> : null}</Div>
      {operation.map((command, i) => (
        <Div key={i}>
          <Step command={command} />
          <Div />
        </Div>
      ))}
      {state === 'SUCCESS' ? (
        <Div>
          <Text> </Text>
          <Text>Your recipe is served! Press enter to exit.</Text>
        </Div>
      ) : null}
    </>
  )
}

const StateIndicator = ({ state }) => {
  if (state === 'complete') {
    return <Text> ✅ </Text>
  } else if (state === 'error') {
    return <Text> ❌ </Text>
  } else {
    return <Spinner />
  }
}

const Config = ({ commands }) => {
  const cmd = commands[0] // Config should only be called once.

  const verb = cmd.state !== 'complete' ? 'Setting' : 'Set'
  return (
    <Div>
      <Box>
        <StateIndicator state={cmd.state} />
        <Text> </Text>
        <Text>
          {verb} up plan for {cmd.name}
        </Text>
      </Box>
    </Div>
  )
}

const NPMPackage = ({ commands }) => {
  const incomplete = commands.some(c => c.state !== 'complete')
  const names = commands.map(c => c.name)

  if (incomplete) {
    return (
      <Div>
        <Text>Installing packages</Text>
        {commands.map(cmd => (
          <Div key={cmd.name}>
            <Box>
              <Text> </Text>
              <StateIndicator state={cmd.state} />
              <Text> </Text>
              <Text>{cmd.name}</Text>
            </Box>
          </Div>
        ))}
      </Div>
    )
  }

  return (
    <Div>
      <Box>
        <StateIndicator state="complete" />
        <Text> </Text>
        <Text>Installed {humanizeList(names)}</Text>
      </Box>
    </Div>
  )
}

const NPMScript = ({ commands }) => {
  const incomplete = commands.some(c => c.state !== 'complete')
  const names = commands.map(c => c.name)

  if (incomplete) {
    return (
      <Div>
        <Text>Adding scripts</Text>
        {commands.map(cmd => (
          <Div key={cmd.name}>
            <Box>
              <Text> </Text>
              <StateIndicator state={cmd.state} />
              <Text> </Text>
              <Text>{cmd.name}</Text>
            </Box>
          </Div>
        ))}
      </Div>
    )
  }

  return (
    <Div>
      <Box>
        <StateIndicator state="complete" />
        <Text> </Text>
        <Text>Added scripts for {humanizeList(names)}</Text>
      </Box>
    </Div>
  )
}

const GatsbyPlugin = ({ commands }) => {
  const incomplete = commands.some(c => c.state !== 'complete')
  const names = commands.map(c => c.name)

  if (incomplete) {
    return (
      <Div>
        <Text>Configuring plugins</Text>
        {commands.map(cmd => (
          <Div key={cmd.name}>
            <Box>
              <Text> </Text>
              <StateIndicator state={cmd.state} />
              <Text> </Text>
              <Text>{cmd.name}</Text>
            </Box>
          </Div>
        ))}
      </Div>
    )
  }

  return (
    <Div>
      <Box>
        <StateIndicator state="complete" />
        <Text> </Text>
        <Text>Configured {humanizeList(names)}</Text>
      </Box>
    </Div>
  )
}

const ShadowFile = ({ commands }) => {
  const incomplete = commands.some(c => c.state !== 'complete')
  const paths = commands.map(c => c.path)

  if (incomplete) {
    return (
      <Div>
        <Text>Shadowing files</Text>
        {commands.map(cmd => (
          <Div key={cmd.path}>
            <Box>
              <Text> </Text>
              <StateIndicator state={cmd.state} />
              <Text> </Text>
              <Text>{cmd.path}</Text>
            </Box>
          </Div>
        ))}
      </Div>
    )
  }

  return (
    <Div>
      <Box>
        <StateIndicator state="complete" />
        <Text> </Text>
        <Text>Shadowed {humanizeList(paths)}</Text>
      </Box>
    </Div>
  )
}

const File = ({ commands }) => {
  const incomplete = commands.some(c => c.state !== 'complete')
  const paths = commands.map(c => c.path)

  if (incomplete) {
    return (
      <Div>
        <Text>Writing files</Text>
        {commands.map(cmd => (
          <Div key={cmd.path}>
            <Box>
              <Text> </Text>
              <StateIndicator state={cmd.state} />
              <Text> </Text>
              <Text>{cmd.path}</Text>
            </Box>
          </Div>
        ))}
      </Div>
    )
  }

  return (
    <Div>
      <Box>
        <StateIndicator state="complete" />
        <Text> </Text>
        <Text>Created file {humanizeList(paths)}</Text>
      </Box>
    </Div>
  )
}

const Step = ({ command }) => {
  return Object.entries(command).map(([cmdName, cmds], i) => {
    if (cmdName === 'Config') {
      return <Config key={i} commands={cmds} />
    } else if (cmdName === 'NPMPackage') {
      return <NPMPackage key={i} commands={cmds} />
    } else if (cmdName === 'NPMScript') {
      return <NPMScript key={i} commands={cmds} />
    } else if (cmdName === 'GatsbyPlugin') {
      return <GatsbyPlugin key={i} commands={cmds} />
    } else if (cmdName === 'ShadowFile') {
      return <ShadowFile key={i} commands={cmds} />
    } else if (cmdName === 'File') {
      return <File key={i} commands={cmds} />
    } else {
      return <Text key={i}>{cmdName}</Text>
    }
  })
}

const Wrapper = () => {
  return (
    <Provider value={client}>
      <RecipeInterpreter commands={allCommands} />
    </Provider>
  )
}

const Recipe = () => {
  return <Wrapper steps={stepsAsMDX} />
}

render(<Recipe />)
