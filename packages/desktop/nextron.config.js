module.exports = {
    webpack: (config) => {
        // Nextron v10 builds main and preload separately.
        config.entry.main = './main/application.ts'
        config.module.rules.push({
            test: /\.node$/,
            loader: 'node-loader',
        })
        return config
    },
}
