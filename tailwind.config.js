/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1d1d1f', 2: '#48484a', 3: '#86868b', 4: '#aeaeb2' },
        // Identidad: marrón La Montada y crema. Alias gold conservado para compatibilidad.
        accent: {
          50: '#faf7f5',
          100: '#f2eae5',
          200: '#e3d3ca',
          300: '#c9aea0',
          400: '#a78677',
          500: '#89685b',
          600: '#6b4f46',
          700: '#4b3836',
          800: '#3e2e2c',
          900: '#302321',
        },
        gold: {
          50: '#faf7f5',
          100: '#f2eae5',
          200: '#e3d3ca',
          300: '#c9aea0',
          400: '#a78677',
          500: '#89685b',
          600: '#6b4f46',
          700: '#4b3836',
          800: '#3e2e2c',
          900: '#302321',
        },
        // Negro/superficies — para sidebar, header oscuro y elementos "ink".
        surface: {
          950: '#08090a',
          900: '#0c0d0f',
          800: '#121316',
          700: '#191b1f',
          600: '#212328',
          500: '#2b2e34',
          400: '#43464d',
          300: '#5c6069',
        },
      },
      // Texto neutro; los fondos, bordes y gráficos conservan el marrón de marca.
      textColor: {
        accent: Object.fromEntries([50,100,200,300,400,500,600,700,800,900].map(shade => [shade, "#111111"])),
        gold: Object.fromEntries([50,100,200,300,400,500,600,700,800,900].map(shade => [shade, "#111111"])),
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.625rem',
        card: '1.5rem',
        pill: '999px',
      },
      boxShadow: {
        // Sombras contenidas, sin halos ni "glow" — solo separación sutil.
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        raised: '0 4px 16px -4px rgb(0 0 0 / 0.10), 0 2px 6px -2px rgb(0 0 0 / 0.06)',
        popover: '0 12px 32px -8px rgb(0 0 0 / 0.16), 0 4px 12px -4px rgb(0 0 0 / 0.08)',
      },
      transitionTimingFunction: {
        // Curva "apple-like": arranque rápido, frenado suave.
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        150: '150ms',
        220: '220ms',
        320: '320ms',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'fade-in-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(0.97)' }, to: { opacity: 1, transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in-up': 'fade-in-up 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}
