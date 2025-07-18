const Encore = require('@symfony/webpack-encore');
const path = require('path');

if (!Encore.isRuntimeEnvironmentConfigured()) {
    Encore.configureRuntimeEnvironment(process.env.NODE_ENV || 'dev');
}

Encore
    .setOutputPath('public/build/')
    .setPublicPath('/build')

    .addEntry('app', './assets/js/app.tsx')
    .addStyleEntry('app-styles', './assets/css/app.scss')

    .enableReactPreset()
    .enableTypeScriptLoader()

    .enableSingleRuntimeChunk()
    .cleanupOutputBeforeBuild()
    .enableBuildNotifications()
    .enableSourceMaps(!Encore.isProduction())
    .enableVersioning(Encore.isProduction())

    .enableSassLoader()

    .configureBabelPresetEnv((config) => {
        config.useBuiltIns = 'usage';
        config.corejs = 3;
    })

    // Aliasy PŘED module.exports
    .addAliases({
        '@': path.resolve(__dirname, 'assets/js'),
        '@components': path.resolve(__dirname, 'assets/js/components'),
        '@services': path.resolve(__dirname, 'assets/js/services'),
        '@utils': path.resolve(__dirname, 'assets/js/utils'),
        '@hooks': path.resolve(__dirname, 'assets/js/hooks'),
        '@contexts': path.resolve(__dirname, 'assets/js/contexts'),
        '@types': path.resolve(__dirname, 'assets/types'),
        '@images': path.resolve(__dirname, 'assets/images')
    });

module.exports = Encore.getWebpackConfig();