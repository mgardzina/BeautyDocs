import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // --- STYLE: GOLD & MARBLE PALETTE (LIGHT) ---

        // 1. ZŁOTO (Akcenty luksusowe, bordy, ikony)
        brand: {
          DEFAULT: "#D4AF37", // Metallic Gold
          dark: "#B5952F",    // Darker gold (hover)
          light: "#F3E5AB",   // Champagne
          text: "#FFFFFF",    // White text (on gold buttons only)
        },

        // 2. JASNY MARMUR (Sekcje formularzy - jasne karty)
        emerald: {
          DEFAULT: "#F2EDE7", // Marble white - section bg
          dark: "#E8E2DA",    // Slightly darker marble (hover)
          light: "#FAF8F5",   // Almost white marble (highlights)
          sage: "#4A4038",    // Dark stone (label text - czytelne)
          glass: "rgba(242, 237, 231, 0.92)", // Semi-transparent marble
        },

        // 3. UI & STRUCTURE (Jasna baza)
        ui: {
          bg: "#FAF8F5",        // Light marble for inputs
          bgSecondary: "#F2EDE7", // Marble secondary
          card: "#FAF8F5",      // Card background
          border: "#D4AF37",    // Gold borders
          borderStrong: "#D4AF37", // Gold border strong
          borderLight: "#D1C9BF", // Subtle marble border
          textSecondary: "#4A4038", // Darker muted labels (czytelne)
          textMuted: "#7A6E62",
          textLight: "#5A4F44",
        },

        // Marble surface colors
        marble: {
          bg: "#F2EDE7",        // Marble background
          text: "#2D2520",      // Dark text on marble
          textSecondary: "#5A4F44", // Darker muted text (czytelne)
          border: "#D1C9BF",    // Subtle border
        },

        // Validation Colors
        success: {
          bg: "rgba(21, 128, 61, 0.1)",
          text: "#16a34a",
          border: "rgba(22, 163, 106, 0.25)",
        },
        error: {
          bg: "rgba(185, 28, 28, 0.1)",
          text: "#dc2626",
          border: "rgba(220, 38, 38, 0.25)",
        },

        // Shadcn/UI mappings
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // Legacy scaffolding
        primary: {
          beige: "#D4AF37",
          taupe: "#F2EDE7",
          green: "#F2EDE7",
        },
        bg: {
          light: "#F2EDE7",
          main: "#F2EDE7",
        },
        text: {
          dark: "#2D2520",
          light: "#7A6E62",
        },
        accent: {
          warm: "#D4AF37",
          cool: "#7A6E62",
        },
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "serif"],
        sans: ["var(--font-lato)", "sans-serif"],
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(45deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
        'gradient-emerald': 'linear-gradient(to bottom, #F2EDE7, #EBE5DD)',
      },
      boxShadow: {
        'marble': '0 2px 15px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04)',
        'marble-lg': '0 4px 25px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.05)',
      },
      letterSpacing: {
        widest: "0.2em",
        wider: "0.15em",
      },
    },
  },
  plugins: [],
};

export default config;
