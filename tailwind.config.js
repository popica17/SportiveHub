/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "primary-blue": "#2e9ccc",
        "primary-blue-hover": "#126082",
        "secondary-blue": "#1982b0",
      },
    },
  },
  plugins: [],
};
