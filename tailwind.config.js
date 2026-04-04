/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        daw: {
          // Core surfaces — inspired by Ableton/Logic dark themes
          bg: '#0d0d0d',
          'bg-alt': '#141414',
          surface: '#1a1a1a',
          'surface-alt': '#1f1f1f',
          panel: '#242424',
          'panel-hover': '#2a2a2a',
          border: '#333333',
          'border-light': '#3a3a3a',

          // Text
          text: '#e0e0e0',
          'text-dim': '#777777',
          'text-muted': '#555555',

          // Accent — warm orange like Ableton
          accent: '#ff6b35',
          'accent-dim': '#cc5529',
          'accent-glow': 'rgba(255, 107, 53, 0.15)',

          // Track colors
          track: '#1a1a1a',
          'track-alt': '#161616',
          'track-selected': '#1e1e1e',

          // Timeline
          grid: '#2a2a2a',
          'grid-bar': '#383838',
          playhead: '#ff6b35',
          waveform: '#5ec4e6',
          'waveform-fill': 'rgba(94, 196, 230, 0.15)',
          midi: '#7ee87e',

          // Meters
          meter: {
            green: '#4ade80',
            yellow: '#f5c542',
            red: '#ef4444',
            bg: '#111111',
          },

          // AI Co-Producer
          ai: {
            bg: '#141418',
            accent: '#a78bfa',
            'accent-dim': '#8b6fe0',
            suggestion: '#7c3aed',
            'suggestion-glow': 'rgba(124, 58, 237, 0.12)',
          },

          // Transport
          transport: {
            bg: '#111111',
            play: '#4ade80',
            stop: '#888888',
            record: '#ef4444',
          },
        },
      },
      fontFamily: {
        mono: [
          'JetBrains Mono', 'SF Mono', 'Fira Code',
          'Cascadia Code', 'monospace',
        ],
        sans: [
          'Inter', '-apple-system', 'BlinkMacSystemFont',
          'Segoe UI', 'sans-serif',
        ],
      },
      fontSize: {
        'xxs': ['10px', '14px'],
      },
      boxShadow: {
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.04)',
        'panel': '0 1px 3px rgba(0,0,0,0.4)',
        'control': '0 1px 2px rgba(0,0,0,0.5)',
        'fader': '0 2px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [],
};
