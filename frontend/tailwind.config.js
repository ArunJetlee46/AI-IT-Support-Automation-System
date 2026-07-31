/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1e40af',
        secondary: '#64748b',
        success: '#16a34a',
        warning: '#ea580c',
        danger: '#dc2626',
        info: '#0ea5e9',
      },
    },
  },
  plugins: [],
}
