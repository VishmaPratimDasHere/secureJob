/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        main: "hsl(var(--main))",
        "main-foreground": "hsl(var(--main-foreground))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        "secondary-background": "hsl(var(--secondary-background))",
        overlay: "hsl(var(--overlay))",
        "overlay-foreground": "hsl(var(--overlay-foreground))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        base: "var(--rounded)",
      },
      boxShadow: {
        shadow: "var(--box-shadow-x) var(--box-shadow-y) 0px 0px var(--shadow-color)",
      },
      translate: {
        boxShadowX: "var(--box-shadow-x)",
        boxShadowY: "var(--box-shadow-y)",
        reverseBoxShadowX: "var(--reverse-box-shadow-x)",
        reverseBoxShadowY: "var(--reverse-box-shadow-y)",
      },
      fontWeight: {
        base: "500",
        heading: "700",
      },
      fontFamily: {
        base: ['"DM Sans"', 'sans-serif'],
        heading: ['"Lexend"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
