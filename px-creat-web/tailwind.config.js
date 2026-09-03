/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 语义色全部走 CSS 变量（src/index.css），由 data-theme（bocchi/miku）与 .dark 组合驱动。
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        'bg-alt': 'rgb(var(--c-bg-alt) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        surface2: 'rgb(var(--c-surface-2) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        inkSoft: 'rgb(var(--c-ink-soft) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        primaryStrong: 'rgb(var(--c-primary-strong) / <alpha-value>)',
        primarySoft: 'rgb(var(--c-primary-soft) / <alpha-value>)',
        primaryFaint: 'rgb(var(--c-primary-faint) / <alpha-value>)',
        onPrimary: 'rgb(var(--c-on-primary) / <alpha-value>)',
        heroFrom: 'rgb(var(--c-hero-from) / <alpha-value>)',
        heroTo: 'rgb(var(--c-hero-to) / <alpha-value>)',
        heroInk: 'rgb(var(--c-hero-ink) / <alpha-value>)',
      },
      borderRadius: {
        // web-style 基准：卡片 24–32px、缩略图 12–20px；按钮全 pill 走 rounded-full。
        cardSm: '1.5rem',
        card: '1.75rem',
        cardLg: '2rem',
        thumb: '1rem',
        thumbSm: '0.75rem',
      },
      boxShadow: {
        soft: '0 8px 24px rgb(var(--c-shadow) / 0.12)',
        'soft-lg': '0 20px 48px rgb(var(--c-shadow) / 0.16)',
        sticker: '0 4px 14px rgb(var(--c-shadow) / 0.14)',
      },
      dropShadow: {
        sticker: '0 4px 8px rgb(var(--c-shadow) / 0.35)',
      },
      fontFamily: {
        sans: [
          'Poppins',
          'Nunito',
          'Quicksand',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif',
        ],
      },
      backgroundImage: {
        'hero-gradient':
          'linear-gradient(135deg, rgb(var(--c-hero-from)) 0%, rgb(var(--c-hero-mid) / 0.9) 52%, rgb(var(--c-hero-to)) 100%)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        popIn: {
          from: { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        slideInUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'pop-in': 'popIn 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.15)',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'slide-in-left': 'slideInLeft 0.25s ease-out',
        'slide-in-up': 'slideInUp 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
