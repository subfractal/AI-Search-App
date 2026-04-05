/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        daw: {
          // Industrial-Konstrukt — Signal & Shadow palette
          bg: '#050505',
          'bg-alt': '#080808',
          surface: '#0F0F11',
          'surface-alt': '#131315',
          panel: '#0F0F11',
          'panel-hover': '#1a1a1c',
          border: '#222224',
          'border-light': '#2a2a2c',

          // Text — Concrete Gray
          text: '#D1D1D1',
          'text-dim': '#888888',
          'text-muted': '#555555',

          // Accent — Safety Orange
          accent: '#F77F00',
          'accent-dim': '#c46600',

          // Track type — monochrome except AI
          'type-audio': '#D1D1D1',
          'type-midi': '#D1D1D1',
          'type-ai': '#E63946',

          // Track surfaces
          track: '#0a0a0a',
          'track-alt': '#080808',
          'track-selected': '#141414',

          // Timeline
          grid: '#1a1a1a',
          'grid-bar': '#222224',
          playhead: '#E63946',
          waveform: '#D1D1D1',
          'waveform-fill': 'rgba(209,209,209,0.08)',
          midi: '#D1D1D1',

          // Meters — monochrome
          meter: {
            green: '#D1D1D1',
            yellow: '#F77F00',
            red: '#E63946',
            bg: '#050505',
          },

          // AI Co-Producer — Signal Red
          ai: {
            bg: '#080808',
            accent: '#E63946',
            'accent-dim': '#b82d38',
            suggestion: '#E63946',
          },

          // Transport
          transport: {
            bg: '#050505',
            play: '#D1D1D1',
            stop: '#888888',
            record: '#E63946',
          },

          // LCD display — Signal Red on black
          lcd: {
            bg: '#050505',
            text: '#E63946',
            dim: '#222224',
          },
        },
      },
      fontFamily: {
        mono: [
          'Roboto Mono', 'SF Mono', 'Fira Code',
          'Cascadia Code', 'monospace',
        ],
        sans: [
          'IBM Plex Sans', '-apple-system', 'BlinkMacSystemFont',
          'Segoe UI', 'sans-serif',
        ],
      },
      fontSize: {
        'xxs': ['10px', '14px'],
      },
      boxShadow: {
        'panel': '0 1px 2px rgba(0,0,0,0.8)',
        'control': '0 1px 2px rgba(0,0,0,0.8)',
        'fader': '0 1px 3px rgba(0,0,0,0.8)',
        'lcd': 'inset 0 1px 4px rgba(0,0,0,0.9)',
        'knob': '0 1px 2px rgba(0,0,0,0.6)',
      },
      animation: {
        'blink-signal': 'blink-signal 1s step-end infinite',
      },
      keyframes: {
        'blink-signal': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
