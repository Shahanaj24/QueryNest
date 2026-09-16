/**
 * Design tokens and global styles.
 *
 * The brief asks for a professional, restrained interface rather than a flashy
 * one, so the palette is deliberately narrow: a near-neutral grey scale for
 * structure, with a single deep teal used only for genuine actions and the
 * active state. Nothing else competes for attention.
 */

import { createGlobalStyle } from 'styled-components';

export const theme = {
  color: {
    ink: '#16181d',        // primary text
    inkSoft: '#5c6370',    // secondary text
    inkFaint: '#8b919c',   // meta text, placeholders
    paper: '#ffffff',      // cards, chat surface
    canvas: '#f7f8f9',     // app background
    rail: '#f2f3f5',       // sidebar
    line: '#e4e6ea',       // borders
    lineSoft: '#eef0f2',
    accent: '#1f6a62',     // deep teal: buttons, active nav, focus
    accentHover: '#175048',
    accentSoft: '#e8f1ef',
    danger: '#b4342b',
    dangerSoft: '#fdeceb',
    success: '#1f7a4d',
    successSoft: '#e9f5ee',
  },
  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    pill: '999px',
  },
  font: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  },
  shadow: {
    card: '0 1px 2px rgba(22, 24, 29, 0.05)',
    raised: '0 4px 16px rgba(22, 24, 29, 0.10)',
  },
};

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }

  html, body, #root {
    height: 100%;
  }

  body {
    margin: 0;
    padding: 0;
    background: ${theme.color.canvas};
    color: ${theme.color.ink};
    font-family: ${theme.font.sans};
    font-size: 15px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }

  button, input, textarea { font-family: inherit; font-size: inherit; }

  /* Keyboard focus stays visible everywhere; mouse clicks stay clean. */
  :focus-visible {
    outline: 2px solid ${theme.color.accent};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
