const path = require('node:path')

module.exports = {
    webpack: (config) => {
        config.entry.main = './main/application.ts'
        // Nextron's default TS loader only includes main/. The main process
        // also imports the shared settings module in renderer/context/.
        for (const rule of config.module.rules) {
            if (rule && rule.test instanceof RegExp && rule.test.test('settings.ts') && rule.include) {
                rule.include = [rule.include, path.resolve(__dirname, 'renderer/context')]
            }
        }
        config.module.rules.push({
            test: /\.node$/,
            loader: 'node-loader',
        })
        return config
    },
}
