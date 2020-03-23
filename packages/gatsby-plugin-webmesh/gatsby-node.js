const fs = require('fs')
const path = require('path')
const util = require('util')

const mkdirp = require('mkdirp')
const bodyParser = require('body-parser')
const globby = require('globby')

const RecipesTemplate = require.resolve('./src/templates/recipes')
const EditorTemplate = require.resolve('./src/templates/editor')

const write = util.promisify(fs.writeFile)
const read = util.promisify(fs.readFile)

exports.onPreBootstrap = ({ store }) => {
  const { program } = store.getState()

  const dirs = [path.join(program.directory, 'src', 'recipes')]

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      mkdirp.sync(dir)
    }
  })
}

exports.onCreateDevServer = ({ app, store, reporter }) => {
  const state = store.getState()
  const dirname = path.join(state.program.directory, 'src', 'recipes')

  const getFileContents = async page => {
    const filename = path.join(dirname, page)
    const contents = await read(filename, 'utf8')
    return contents
  }

  const relativizePagePath = pagePath => {
    return pagePath.replace(dirname + path.sep, '')
  }

  app.use(bodyParser.json())

  app.post('/___recipes', async (req, res) => {
    const { code, recipe } = req.body

    if (!code || !recipe) {
      return res.status(500).send({
        error: 'Did not receive code'
      })
    }

    const filename = path.join(dirname, recipe)
    const currentCode = await getFileContents(recipe)

    if (code !== currentCode) {
      reporter.info(`Updating ${recipe}`)
      await write(filename, code)
      reporter.success(`Updated ${recipe}`)
    }

    res.send('success')
  })

  app.post('/___recipes/src', async (req, res) => {
    const { recipe } = req.body

    if (!recipe) {
      return res.status(500).send({
        error: 'Did not receive recipe'
      })
    }

    const code = await getFileContents(recipe)
    res.send(code)
  })

  app.get('/___recipes/all', async (_, res) => {
    const globPattern = dirname + '/**/*.mdx'
    const pages = globby.sync(globPattern, { nodir: true })
    res.send(pages.map(relativizePagePath))
  })
}

exports.createPages = ({ actions }) => {
  const { createPage } = actions

  createPage({
    path: '___recipes',
    component: RecipesTemplate
  })
  createPage({
    path: '___recipes/edit',
    component: EditorTemplate
  })
}
