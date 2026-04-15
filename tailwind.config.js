/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary:               '#006b5a',
        'primary-container':   '#48c2a9',
        'primary-fixed':       '#81f7dc',
        surface:               '#f7f9fb',
        'surface-low':         '#f2f4f6',
        'surface-lowest':      '#ffffff',
        'on-surface':          '#191c1e',
        'on-surface-variant':  '#3d4945',
        'outline-variant':     '#bccac4',
        'secondary-fixed':     '#d7e2fe',
        'on-secondary-fixed':  '#101c30',
        'tertiary-container':  '#5dc0a7',
        medical: {
          50:  '#f0f7ff',
          100: '#e0effe',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#0f172a',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      fontFamily: {
        sans:    ['Manrope', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
