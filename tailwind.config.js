/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./assets/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'profound-blue': '#0066FF',
        'profound-dark': '#0D1117',
        'profound-gray': '#21262D',
        'profound-border': '#30363D',
        'success': '#2EA043',
        'warning': '#FB8500',
        'danger': '#F85149'
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace']
      }
    }
  },
  plugins: [],
}