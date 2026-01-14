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
        // Brand Colors
        'brand-primary': '#1E90FF', // Dodger Blue
        'brand-heavy': '#176FC7',   // Darker blue for hover/emphasis
        'brand-subtle': '#7BC3FF',  // Lighter blue for backgrounds
        
        // Background Hierarchy
        'bg-1': '#F6F6F6',  // Pearl White - main background
        'bg-2': '#EEF2F8',  // Secondary background
        'bg-3': '#FFFFFF',  // Card/container backgrounds
        'bg-4': '#E9F1FB',  // Subtle blue-tinted background
        
        // Border Colors
        'border-primary': '#E0E7F1',   // Main borders
        'border-secondary': '#C6D4E5', // Medium emphasis
        'border-tertiary': '#A5B8D1',  // Strong emphasis
        
        // Text Colors
        'text-primary': '#0F172A',   // Main text
        'text-secondary': '#1F2937', // Secondary text
        'text-tertiary': '#4B5563',  // Tertiary/muted text
        'text-inverted': '#FFFFFF',  // Text on colored backgrounds
        
        // Status Colors
        'destructive': '#EF4444',     // Error/danger
        'success': '#22C55E',         // Success green
        
        // Legacy support (keeping for backward compatibility)
        'dodger-blue': {
          50: '#eff8ff',
          100: '#dbeffe',
          200: '#bfe3fe',
          300: '#93d4fd',
          400: '#60bcfa',
          500: '#1E90FF',
          600: '#176FC7',
          700: '#1568c4',
          800: '#16559f',
          900: '#18497d',
          950: '#132d4d',
        },
        'pearl-white': {
          50: '#fefefe',
          100: '#fcfcfc',
          200: '#f9f9f9',
          300: '#F6F6F6',
          400: '#f0f0f0',
          500: '#eaeaea',
          600: '#d5d5d5',
          700: '#b3b3b3',
          800: '#8f8f8f',
          900: '#6b6b6b',
        },
      },
      fontFamily: {
        'display': ['Space Grotesk', 'system-ui', '-apple-system', 'sans-serif'],
        'body': ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'sans': ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'display-hero': ['clamp(2.5rem, 8vw, 6rem)', { lineHeight: '0.9', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-xl': ['clamp(2rem, 6vw, 4.5rem)', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'heading-xl': ['clamp(1.75rem, 4vw, 3rem)', { lineHeight: '1.2', fontWeight: '700' }],
        'heading-lg': ['clamp(1.5rem, 3vw, 2.25rem)', { lineHeight: '1.2', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', letterSpacing: '-0.011em', fontWeight: '500' }],
        'body-md': ['1rem', { lineHeight: '1.6', letterSpacing: '-0.011em', fontWeight: '500' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
      },
      spacing: {
        // 8px base unit with Fibonacci rhythm
        '18': '4.5rem',   // 72px
        '22': '5.5rem',   // 88px
        '26': '6.5rem',   // 104px
      },
      borderRadius: {
        'comic': '0.65rem',
      },
      boxShadow: {
        'comic': '0 14px 40px -24px rgba(15, 23, 42, 0.35)',
        'comic-lg': '0 22px 60px -26px rgba(15, 23, 42, 0.4)',
        'comic-xl': '0 28px 70px -30px rgba(15, 23, 42, 0.45)',
        'glow-hero': '0 40px 160px rgba(30, 144, 255, 0.25)',
        'brand-primary': '0 18px 60px -26px rgba(30, 144, 255, 0.8)',
        'brand-primary-hover': '0 22px 70px -28px rgba(30, 144, 255, 0.9)',
        'workspace': '0 14px 40px -24px rgba(15, 23, 42, 0.35)',
        'workspace-lg': '0 22px 60px -26px rgba(15, 23, 42, 0.4)',
        'workspace-xl': '0 28px 70px -30px rgba(15, 23, 42, 0.45)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
