/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        surface: {
          900: '#0a0a0b',
          800: '#111113',
          700: '#18181b',
          600: '#1e1e22',
          500: '#27272b',
          400: '#3f3f46',
          300: '#52525b',
        },
      },
    },
  },
  plugins: [],
}

