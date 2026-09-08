/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0F1A',
        panel: '#111827',
        'panel-raised': '#161F33',
        hairline: '#232E45',
        text: {
          DEFAULT: '#E5E9F0',
          dim: '#8992A9',
          faint: '#5C6680',
        },
        amber: {
          DEFAULT: '#F2A93B',
          dim: '#7A5A22',
          soft: '#3A2D14',
        },
        signal: {
          green: '#3DDC84',
          'green-soft': '#123324',
          blue: '#4C8DFF',
          'blue-soft': '#132A4D',
          red: '#FF5C5C',
          'red-soft': '#3A1616',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
}
