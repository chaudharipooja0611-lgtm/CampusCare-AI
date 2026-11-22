/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        // navy blue scale (kept under the "brand" name used across the app)
        brand: { 50: '#f2f5fc', 100: '#e1e8f8', 200: '#c5d2f1', 300: '#9bb1e6', 400: '#6a86d6', 500: '#4562c2', 600: '#2f4aa6', 700: '#243a85', 800: '#1b2d6a', 900: '#131f4d', 950: '#0b1437' },
        ink: { 900: '#0e1633', 700: '#38435f', 500: '#6b7590' },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11,20,55,.04), 0 10px 30px -12px rgba(19,31,77,.14)',
        glow: '0 14px 44px -14px rgba(124,58,237,.35)',
        navy: '0 20px 50px -20px rgba(11,20,55,.6)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(14px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        blob: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(30px,-20px) scale(1.1)' } },
        grow: { '0%': { width: '0%' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pulse2: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.55 } },
      },
      animation: {
        'fade-up': 'fade-up .55s ease-out both',
        'fade-in': 'fade-in .4s ease-out both',
        float: 'float 6s ease-in-out infinite',
        blob: 'blob 12s ease-in-out infinite',
        grow: 'grow 1s ease-out both',
        pulse2: 'pulse2 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
