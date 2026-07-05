/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Superficies y textos como variables CSS: los valores viven en
        // index.css y se invierten en modo claro sin tocar los componentes.
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
          card: 'rgb(var(--ink-card) / <alpha-value>)',
          raised: 'rgb(var(--ink-raised) / <alpha-value>)',
          border: 'rgb(var(--ink-border) / <alpha-value>)',
        },
        zinc: {
          100: 'rgb(var(--z100) / <alpha-value>)',
          200: 'rgb(var(--z200) / <alpha-value>)',
          300: 'rgb(var(--z300) / <alpha-value>)',
          400: 'rgb(var(--z400) / <alpha-value>)',
          500: 'rgb(var(--z500) / <alpha-value>)',
          600: 'rgb(var(--z600) / <alpha-value>)',
          700: 'rgb(var(--z700) / <alpha-value>)',
          800: 'rgb(var(--z800) / <alpha-value>)',
          900: 'rgb(var(--z900) / <alpha-value>)',
        },
        accent: {
          DEFAULT: '#a3e635', // verde lima eléctrico
          bright: '#bef264',
          dim: '#65a30d',
          ink: '#1a2e05', // texto sobre acento
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'draw-circle': {
          from: { strokeDashoffset: '264' },
          to: { strokeDashoffset: '0' },
        },
        'draw-check': {
          from: { strokeDashoffset: '52' },
          to: { strokeDashoffset: '0' },
        },
        halo: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '0.7' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'draw-circle': 'draw-circle 0.7s ease-out both',
        'draw-check': 'draw-check 0.45s ease-out 0.55s both',
        halo: 'halo 1.2s ease-out both',
      },
    },
  },
  plugins: [],
}
