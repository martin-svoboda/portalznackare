/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./assets/**/*.{js,ts,jsx,tsx,scss}",
    "./templates/**/*.{html,twig}",
    "./src/**/*.php",
  ],
  theme: {
    extend: {
      colors: {
        // KČT brand colors
        'kct': {
          'green': '#2d7d20',
          'blue': '#1e40af',
          'yellow': '#ca8a04',
          'red': '#dc2626',
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
  // Dark mode support
  darkMode: 'class',
}