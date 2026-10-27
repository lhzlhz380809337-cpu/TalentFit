/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A237E',
          50: '#E8EAF6',
          100: '#C5CAE9',
          200: '#9FA8DA',
          300: '#7986CB',
          400: '#5C6BC0',
          500: '#3F51B5',
          600: '#303F9F',
          700: '#1A237E',
          800: '#151B60',
          900: '#0D1137',
        },
        accent: {
          DEFAULT: '#FF8F00',
          50: '#FFF8E1',
          100: '#FFECB3',
          200: '#FFE082',
          300: '#FFD54F',
          400: '#FFCA28',
          500: '#FFC107',
          600: '#FFB300',
          700: '#FF8F00',
          800: '#FF6F00',
          900: '#E65100',
        },
        surface: {
          DEFAULT: '#F5F6FA',
          card: '#FFFFFF',
        },
        success: '#2E7D32',
        warning: '#F57F17',
        danger: '#C62828',
      },
      borderRadius: {
        card: '12px',
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
