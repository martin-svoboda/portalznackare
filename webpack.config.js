const Encore = require('@symfony/webpack-encore');
const path = require('path');

if (!Encore.isRuntimeEnvironmentConfigured()) {
    Encore.configureRuntimeEnvironment(process.env.NODE_ENV || 'dev');
}

Encore
    .setOutputPath('public/build/')
    .setPublicPath('/build')

    // CSS entry pro základní styly
    .addStyleEntry('app-styles', './assets/css/app.scss')
    
    // React apps entries
    .addEntry('app-prikazy', './assets/js/apps/prikazy/index.jsx')
    .addEntry('app-prikaz-detail', './assets/js/apps/prikaz-detail/index.jsx')
    .addEntry('app-hlaseni-prikazu', './assets/js/apps/hlaseni-prikazu/index.jsx')
    .addEntry('insys-tester', './assets/js/apps/insys-tester/index.jsx')

    .enableReactPreset()
    .enableTypeScriptLoader()

    .enableSingleRuntimeChunk()
    .cleanupOutputBeforeBuild()
    .enableBuildNotifications()
    .enableSourceMaps(!Encore.isProduction())
    .enableVersioning(Encore.isProduction())

    .enableSassLoader()
    .enablePostCssLoader()

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
        '@types': path.resolve(__dirname, 'assets/types'),
        '@images': path.resolve(__dirname, 'assets/images')
    });

module.exports = Encore.getWebpackConfig();