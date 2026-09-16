/**
 * Markdown rendering for assistant answers.
 *
 * Requirement 12 asks for paragraphs, bullet points, numbered lists, headings
 * and code blocks rather than one dense block of text. Styling is defined once
 * on a wrapper so every answer reads consistently.
 */

import ReactMarkdown from 'react-markdown';
import styled from 'styled-components';
import { theme } from '../theme';

const Prose = styled.div`
  font-size: 15px;
  line-height: 1.65;
  color: ${theme.color.ink};
  overflow-wrap: anywhere;

  > *:first-child { margin-top: 0; }
  > *:last-child { margin-bottom: 0; }

  p { margin: 0 0 12px; }

  h1, h2, h3, h4 {
    margin: 20px 0 8px;
    font-weight: 600;
    line-height: 1.3;
  }
  h1 { font-size: 18px; }
  h2 { font-size: 16.5px; }
  h3, h4 { font-size: 15px; }

  ul, ol { margin: 0 0 12px; padding-left: 22px; }
  li { margin-bottom: 5px; }
  li > p { margin: 0; }

  strong { font-weight: 600; }

  a {
    color: ${theme.color.accent};
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  code {
    font-family: ${theme.font.mono};
    font-size: 13px;
    background: ${theme.color.lineSoft};
    padding: 1.5px 5px;
    border-radius: 4px;
  }

  pre {
    background: ${theme.color.canvas};
    border: 1px solid ${theme.color.line};
    border-radius: ${theme.radius.md};
    padding: 12px 14px;
    overflow-x: auto;
    margin: 0 0 12px;

    code { background: none; padding: 0; font-size: 12.5px; line-height: 1.5; }
  }

  blockquote {
    margin: 0 0 12px;
    padding-left: 14px;
    border-left: 3px solid ${theme.color.line};
    color: ${theme.color.inkSoft};
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 12px;
    font-size: 14px;
  }
  th, td {
    border: 1px solid ${theme.color.line};
    padding: 7px 10px;
    text-align: left;
  }
  th { background: ${theme.color.canvas}; font-weight: 600; }
`;

export default function Markdown({ children }) {
  return (
    <Prose>
      <ReactMarkdown>{children}</ReactMarkdown>
    </Prose>
  );
}
