module.exports = {
    webpack: (config) => {
        config.entry.main = './main/application.ts'
        config.module.rules.push({test: /\.node$/, loader: 'node-loader'})
        return config
    },
}
