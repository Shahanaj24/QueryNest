/**
 * Registration page.
 *
 * Validates locally for immediate feedback, but the backend is the authority —
 * its messages are what get shown, so the rules cannot drift apart silently.
 */

import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import AuthLayout from '../layouts/AuthLayout';
import { Alert, Button, Field, FieldError, Input, Label, Spinner } from '../components/ui';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';

const SubmitButton = styled(Button)`
  width: 100%;
`;

const Hint = styled.p`
  margin: 6px 0 0;
  font-size: 12px;
  color: ${theme.color.inkFaint};
`;

// Kept in step with PASSWORD_MIN_LENGTH in the backend config.
const MIN_PASSWORD_LENGTH = 8;

export default function Register() {
  const { register, isAuthenticated, initialising } = useAuth();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!initialising && isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  /** Client-side checks mirroring the backend rules, for instant feedback. */
  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Please enter your name.';
    if (!form.email.trim()) errors.email = 'Please enter your email.';
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = 'The two passwords do not match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      // The <Navigate> guard above redirects once isAuthenticated flips; see
      // the same note in Login.jsx.
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Upload documents and ask questions about them."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      {error && <Alert role="alert">{error}</Alert>}

      <form onSubmit={handleSubmit} noValidate>
        <Field>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={update('name')}
            placeholder="Ada Lovelace"
            autoComplete="name"
            disabled={submitting}
          />
          {fieldErrors.name && <FieldError>{fieldErrors.name}</FieldError>}
        </Field>

        <Field>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={update('email')}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={submitting}
          />
          {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
        </Field>

        <Field>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
            disabled={submitting}
          />
          {fieldErrors.password
            ? <FieldError>{fieldErrors.password}</FieldError>
            : <Hint>At least {MIN_PASSWORD_LENGTH} characters.</Hint>}
        </Field>

        <Field>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            autoComplete="new-password"
            disabled={submitting}
          />
          {fieldErrors.confirmPassword && <FieldError>{fieldErrors.confirmPassword}</FieldError>}
        </Field>

        <SubmitButton type="submit" disabled={submitting}>
          {submitting ? <><Spinner /> Creating account...</> : 'Create account'}
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
