/**
 * 404 page, so an unknown URL lands somewhere deliberate rather than a blank
 * screen. Routed outside the layout because it may be reached while signed out.
 */

import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { theme } from '../theme';

const Screen = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
  background: ${theme.color.canvas};

  h1 { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
  p { margin: 0 0 20px; color: ${theme.color.inkSoft}; font-size: 14px; }
  a {
    color: ${theme.color.accent};
    font-weight: 500;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
`;

export default function NotFound() {
  return (
    <Screen>
      <h1>Page not found</h1>
      <p>That page does not exist.</p>
      <Link to="/dashboard">Back to the dashboard</Link>
    </Screen>
  );
}
