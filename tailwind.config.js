/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: '#0070F3',
        'accent-hover': '#005cc5',
        surface: '#FAFAFA',
        hover: '#F5F5F5',
      },
      borderColor: {
        default: '#EAEAEA',
        light: '#F0F0F0',
      },
      textColor: {
        primary: '#171717',
        secondary: '#666666',
        tertiary: '#999999',
      },
      fontFamily: {
        body: ['var(--font-ibm-plex-sans)', 'IBM Plex Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'IBM Plex Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
