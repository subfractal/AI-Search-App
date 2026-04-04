/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        daw: {
          bg: '#1a1a2e',
          surface: '#16213e',
          panel: '#0f3460',
          accent: '#e94560',
          text: '#eee',
          'text-dim': '#8892a4',
          track: '#1e2a45',
          'track-alt': '#1a2540',
          grid: '#2a3a5c',
          playhead: '#e94560',
          waveform: '#53c0f0',
          midi: '#7ee87e',
          meter: {
            green: '#4ade80',
            yellow: '#facc15',
            red: '#ef4444',
          },
          ai: {
            bg: '#1a1a3e',
            accent: '#a78bfa',
            suggestion: '#7c3aed',
          },
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
