/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./*.js",
    "./src/**/*.js"
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
