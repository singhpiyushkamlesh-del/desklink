/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        desklink: {
          sidebar: '#1e1e2e',
          accent: '#0078d4',
          surface: '#f3f3f3',
        },
      },
    },
  },
  plugins: [],
};
