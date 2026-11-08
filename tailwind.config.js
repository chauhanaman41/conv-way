/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#000000',
        parchment: '#efe6d8',
        bone: '#aca69c',
        ash: '#736e68',
        charcoal: '#605c56',
        petal: '#ffa1f7',
        lime: '#4dff00',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'monospace'],
        display: ['"Space Mono"', '"Geist Mono"', 'monospace'],
      },
      borderRadius: {
        media: '0px',
        pill: '1000px',
        btn: '40px',
      },
    },
  },
  plugins: [],
};
