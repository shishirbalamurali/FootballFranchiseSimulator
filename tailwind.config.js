/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme colors will be injected via CSS variables
        'theme-primary': 'var(--color-primary)',
        'theme-secondary': 'var(--color-secondary)',
        'theme-accent': 'var(--color-accent)',
        'theme-bg-a': 'var(--color-bg-a)',
        'theme-bg-b': 'var(--color-bg-b)',
        // Retro neutrals
        'ink': '#1a1a1a',
        'cream': '#f5f1e8',
        'paper': '#ede8dc',
      },
      fontFamily: {
        'heading': ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        'body': ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        'mono': ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
      borderRadius: {
        'retro': '12px',
        'retro-lg': '20px',
      },
      borderWidth: {
        'thick': '3px',
        'thicker': '4px',
        'thickest': '5px',
      },
      animation: {
        'bounce-subtle': 'bounceSubtle 0.4s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        bounceSubtle: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
