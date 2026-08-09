/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0a0e14',
        'surface-panel': '#10151f',
        'surface-card': '#161c29',
        border: '#242c3d',
        primary: {
          DEFAULT: '#4f8fd1',
          light: '#7fb2e6',
        },
        'text-base': '#eef2f7',
        muted: '#8791a3',
        risk: {
          red: '#e5484d',
          orange: '#f2872c',
          yellow: '#e8c547',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
