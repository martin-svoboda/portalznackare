import { defineConfig } from 'vitest/config';

export default defineConfig({
    // Některé moduly v assets/js mají JSX v souborech .js (např. utils/htmlUtils.js)
    esbuild: {
        loader: 'jsx',
        include: /assets\/js\/.*\.jsx?$/,
        exclude: [],
    },
    test: {
        environment: 'jsdom',
        include: ['assets/js/**/*.test.js'],
    },
});
