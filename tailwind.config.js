/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./*.html",
    "./*.js",
    "./src/**/*.js"
  ],
  safelist: [
    'w-24', 'h-24', 'w-28', 'h-28', 'w-36', 'h-36', 'h-32',
    'min-h-[380px]', 'min-h-[400px]', 'min-h-[420px]', 'min-h-[440px]',
    'max-w-[220px]', 'max-w-[240px]', 'max-w-[290px]', 'max-w-[300px]',
    'dark', 'font-ar', 'font-en', 'active', 'hidden'
  ],
  theme: {
    extend: {
      colors: {
        brandOrange: '#FF5000',
        brandOrangeHover: '#E04600',
        brandBlack: '#0E0E10',
        brandMuted: '#71717A',
        surfaceBase: '#FAFAFA'
      },
      fontFamily: {
        sans: ['"Readex Pro"', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"Space Grotesk"', 'monospace']
      }
    }
  },
  plugins: []
}
