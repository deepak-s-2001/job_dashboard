/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: 'var(--ground)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--ink)',
        accent: {
          pink: '#ff90e8',
          yellow: '#ffc900',
          cyan: '#23a094',
          blue: '#6c8cff',
          lime: '#a8e10c',
          coral: '#ff6b57',
          purple: '#b47cff',
        },
        status: {
          applied: '#6c8cff',
          interviewing: '#ffc900',
          offer: '#22c55e',
          rejected: '#ff6b57',
          ghosted: '#9ca3af',
          withdrawn: '#b47cff',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderWidth: {
        3: '3px',
      },
      boxShadow: {
        hard: '4px 4px 0 0 var(--ink)',
        'hard-sm': '2px 2px 0 0 var(--ink)',
        'hard-lg': '6px 6px 0 0 var(--ink)',
        'hard-xl': '10px 10px 0 0 var(--ink)',
        'hard-pink': '4px 4px 0 0 #ff90e8',
        'hard-inset': 'inset 2px 2px 0 0 var(--ink)',
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '10px',
      },
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
      },
    },
  },
  plugins: [],
}
