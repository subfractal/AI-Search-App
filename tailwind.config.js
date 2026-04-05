/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        daw: {
          // Core surfaces — Z-space depth hierarchy (darkest = deepest)
          bg: '#0a0a0b',
          'bg-alt': '#101012',
          surface: '#141417',
          'surface-alt': '#1a1a1e',
          panel: '#1e1e23',
          'panel-hover': '#262630',
          border: '#2a2a35',
          'border-light': '#35354a',

          // Text hierarchy
          text: '#e2e2ea',
          'text-dim': '#8888a0',
          'text-muted': '#555568',

          // Accent — warm amber-orange
          accent: '#ff6b35',
          'accent-dim': '#cc5529',
          'accent-glow': 'rgba(255, 107, 53, 0.15)',

          // Track type colors
          'type-audio': '#3dd68c',
          'type-midi': '#4ba0ff',
          'type-ai': '#a78bfa',

          // Track surfaces
          track: '#111114',
          'track-alt': '#0e0e11',
          'track-selected': '#18182a',

          // Timeline
          grid: '#1e1e28',
          'grid-bar': '#2a2a3a',
          playhead: '#ff6b35',
          waveform: '#5ec4e6',
          'waveform-fill': 'rgba(94, 196, 230, 0.12)',
          midi: '#4ba0ff',

          // Meters
          meter: {
            green: '#3dd68c',
            yellow: '#f5c542',
            red: '#ef4444',
            bg: '#0a0a0d',
          },

          // AI Co-Producer
          ai: {
            bg: '#0e0e14',
            accent: '#a78bfa',
            'accent-dim': '#8b6fe0',
            suggestion: '#7c3aed',
            'suggestion-glow': 'rgba(124, 58, 237, 0.10)',
          },

          // Transport
          transport: {
            bg: '#0c0c0e',
            play: '#3dd68c',
            stop: '#8888a0',
            record: '#ef4444',
          },

          // LCD display
          lcd: {
            bg: '#060810',
            text: '#b8e0ff',
            dim: '#2a3a50',
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
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.03)',
        'panel': '0 2px 8px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)',
        'control': '0 1px 3px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        'fader': '0 2px 6px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
        'lcd': 'inset 0 2px 8px rgba(0,0,0,0.8), inset 0 0 1px rgba(0,0,0,0.5)',
        'knob': '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glow-accent': '0 0 12px rgba(255, 107, 53, 0.2)',
        'glow-ai': '0 0 12px rgba(167, 139, 250, 0.15)',
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'analyzing': 'analyzing 1.5s ease-in-out infinite',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'analyzing': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' },
        },
      },
    },
  },
  plugins: [],
};
