const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')

const declare = require('@babel/helper-plugin-utils').declare

function updatePluginConfig(pluginOrThemeName, shouldAdd = true) {
  const configPath = path.join(process.cwd(), 'gatsby-config.js')
  const configSrc = fs.readFileSync(configPath)

  const addPlugins = new BabelPluginaddPluginsToGatsbyConfig({
    pluginOrThemeName,
    shouldAdd
  })

  const { code } = babel.transform(configSrc, {
    plugins: [addPlugins.plugin]
  })

  fs.writeFileSync(configPath, code)
}

class BabelPluginaddPluginsToGatsbyConfig {
  constructor({ pluginOrThemeName, shouldAdd }) {
    this.plugin = declare(api => {
      api.assertVersion(7)

      const { types: t } = api

      return {
        visitor: {
          Program({ node }) {
            const plugins = node.body[0].expression.right.properties.find(
              p => p.key.name === 'plugins'
            )
            if (shouldAdd) {
              const exists = plugins.value.elements.some(
                node => node.value === pluginOrThemeName
              )
              if (!exists) {
                plugins.value.elements.push(t.stringLiteral(pluginOrThemeName))
              }
            } else {
              plugins.value.elements = plugins.value.elements.filter(
                node => node.value !== pluginOrThemeName
              )
            }
          }
        }
      }
    })
  }
}

module.exports.updatePluginConfig = updatePluginConfig
