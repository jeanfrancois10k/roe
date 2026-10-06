import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        roe: {
          bg: '#0A0512',
          surface: '#140A24',
          card: '#1C0E33',
          cardHover: '#261445',
          border: '#35185E',
          borderGold: 'rgba(229, 184, 11, 0.25)',
          gold: '#FFD700',
          goldDark: '#E5B80B',
          goldLight: '#FFE55C',
          purple: '#6D28D9',
          purpleDark: '#4C1D95',
          purpleLight: '#8B5CF6',
          textMuted: '#94A3B8',
          textLight: '#F8FAFC',
        },
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #FFD700 0%, #E5B80B 50%, #B8860B 100%)',
        'purple-gradient': 'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)',
        'card-gradient': 'linear-gradient(180deg, rgba(28, 14, 51, 0.9) 0%, rgba(20, 10, 36, 0.95) 100%)',
      },
    },
  },
  plugins: [],
};
export default config;
