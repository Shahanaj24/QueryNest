/**
 * Route guard.
 *
 * Every page is client-side gated so an unauthenticated visitor is sent to the
 * login form instead of seeing an empty shell. This is a convenience only —
 * the real enforcement is the bearer-token dependency on every backend route,
 * which is what actually protects the data.
 */

import { Navigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';

const Centred = styled.div`
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #8b919c;
  font-size: 14px;
`;

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, initialising } = useAuth();
  const location = useLocation();

  // While the stored token is being checked we show nothing rather than
  // bouncing to /login, which would flash the form on every refresh.
  if (initialising) {
    return (
      <Centred>
        <Spinner $size={16} /> Checking your session...
      </Centred>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}
