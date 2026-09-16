/**
 * Sign-in page.
 *
 * Errors are shown as the backend's own safe message ("Invalid email or
 * password.") — the backend deliberately does not distinguish between an
 * unknown email and a wrong password, and the UI must not invent that
 * distinction either.
 */

import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import AuthLayout from '../layouts/AuthLayout';
import { Alert, Button, Field, Input, Label, Spinner } from '../components/ui';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

/** Full-width primary action, used by both auth forms. */
const SubmitButton = styled(Button)`
  width: 100%;
`;

export default function Login() {
  const { login, isAuthenticated, initialising } = useAuth();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Where the user was headed before the guard bounced them here.
  const redirectTo = location.state?.from || '/chat';

  if (!initialising && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      // No imperative navigate here: login() flips isAuthenticated, and the
      // <Navigate> guard above performs the redirect on the next render. One
      // redirect path means the two cannot disagree about the destination.
    } catch (err) {
      setError(errorMessage(err, 'Could not sign you in.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Continue your conversations."
      footer={<>No account yet? <Link to="/register">Create one</Link></>}
    >
      {error && <Alert role="alert">{error}</Alert>}

      <form onSubmit={handleSubmit} noValidate>
        <Field>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={submitting}
          />
        </Field>

        <Field>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            required
            disabled={submitting}
          />
        </Field>

        <SubmitButton type="submit" disabled={submitting || !email || !password}>
          {submitting ? <><Spinner /> Signing in...</> : 'Sign in'}
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
