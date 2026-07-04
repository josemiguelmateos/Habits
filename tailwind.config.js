/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Superficie oscura (dark mode por defecto)
        ink: {
          DEFAULT: '#0a0a0c',
          soft: '#111114',
          card: '#17171b',
          raised: '#1e1e24',
          border: '#2a2a32',
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
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
      },
    },
  },
  plugins: [],
}
