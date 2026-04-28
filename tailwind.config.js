/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // This maps your CSS tokens to Tailwind classes!
        brand: {
          primary: 'var(--color-accent-primary)',
          blue: 'var(--color-accent-blue)',
          red: 'var(--color-accent-red)',
          green: 'var(--color-accent-green)',
        },
        surface: {
          base: 'var(--color-bg-base)',
          card: 'var(--color-bg-surface)',
          hover: 'var(--color-bg-elevated)',
        }
      },
      borderRadius: {
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      }
    },
  },
  plugins: [],
};