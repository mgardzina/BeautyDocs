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
        // --- STYLE #2: ROYAL / EXCLUSIVE PALETTE ---
        
        // 1. ZŁOTO (Akcenty luksusowe, ikony, nagłówki)
        brand: {
          DEFAULT: "#D4AF37", // Metallic Gold
          dark: "#B5952F",    // Darker gold
          light: "#F3E5AB",   // Champagne
          text: "#FFFFFF",    // White text
        },

        // 2. BUTELKOWA ZIELEŃ (Główny kolor stylu nr 2)
        emerald: {
          DEFAULT: "#1B4D3E", // Deep Emerald (Butelkowa zieleń) - do sekcji tła
          dark: "#13382d",    // Darker shade for hovers/active states
          light: "#2C6E5A",   // Lighter emerald for highlights
          sage: "#8FA69D",    // Sage (Szałwia) - kolor uzupełniający/interaktywny
          glass: "rgba(27, 77, 62, 0.8)", // Przezroczysta zieleń (efekt szkła)
        },

        // 3. UI & STRUCTURE (Ciemna baza)
        ui: {
          bg: "#111111",      // Soft Black (lepsza niż #000000)
          bgSecondary: "#1a1a1a", // Dark gray (alternatywa dla kart)
          card: "#1a1a1a",    // Standard dark card background
          border: "#333333",      
          borderStrong: "#D4AF37", // Gold border
          textSecondary: "#8FA69D", // Sage instead of gray for subtext (Styl #2 touch)
          textMuted: "#71717A",     
          textLight: "#E4E4E7",     
        },

        // Validation Colors (Standard)
        success: {
          bg: "rgba(21, 128, 61, 0.1)",  
          text: "#4ade80", 
          border: "rgba(74, 222, 128, 0.2)", 
        },
        error: {
          bg: "rgba(185, 28, 28, 0.1)",
          text: "#f87171",
          border: "rgba(248, 113, 113, 0.2)",
        },

        // Shadcn/UI mappings
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // Legacy scaffolding (Mapped to new Style #2)
        primary: {
          beige: "#D4AF37", // Gold remains
          taupe: "#1B4D3E", // Taupe mapped to Emerald for compatibility
          green: "#1B4D3E", // New direct mapping
        },
        bg: {
          light: "#111111",
          main: "#000000",
        },
        text: {
          dark: "#FFFFFF",
          light: "#8FA69D", // Light text mapped to Sage
        },
        accent: {
          warm: "#D4AF37",
          cool: "#8FA69D", // Sage as cool accent
        },
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "serif"],
        sans: ["var(--font-lato)", "sans-serif"],
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(45deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
        'gradient-emerald': 'linear-gradient(to bottom, #111111, #2D2D2D)',
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