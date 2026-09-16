/**
 * Shared styled primitives.
 *
 * Keeping buttons, inputs and alerts here means every page uses the same
 * spacing, radii and focus behaviour instead of redefining them locally.
 */

import styled, { keyframes, css } from 'styled-components';
import { theme } from '../theme';

export const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: ${({ $size }) => ($size === 'sm' ? '7px 12px' : '10px 18px')};
  border-radius: ${theme.radius.md};
  border: 1px solid transparent;
  font-size: ${({ $size }) => ($size === 'sm' ? '13px' : '14px')};
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  white-space: nowrap;

  ${({ $variant }) => {
    if ($variant === 'ghost') {
      return css`
        background: transparent;
        color: ${theme.color.inkSoft};
        &:hover:not(:disabled) { background: ${theme.color.lineSoft}; color: ${theme.color.ink}; }
      `;
    }
    if ($variant === 'secondary') {
      return css`
        background: ${theme.color.paper};
        color: ${theme.color.ink};
        border-color: ${theme.color.line};
        &:hover:not(:disabled) { background: ${theme.color.canvas}; }
      `;
    }
    if ($variant === 'danger') {
      return css`
        background: transparent;
        color: ${theme.color.danger};
        border-color: transparent;
        &:hover:not(:disabled) { background: ${theme.color.dangerSoft}; }
      `;
    }
    return css`
      background: ${theme.color.accent};
      color: #fff;
      &:hover:not(:disabled) { background: ${theme.color.accentHover}; }
    `;
  }}

  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

export const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${theme.color.line};
  border-radius: ${theme.radius.md};
  background: ${theme.color.paper};
  color: ${theme.color.ink};
  transition: border-color 0.15s ease;

  &::placeholder { color: ${theme.color.inkFaint}; }
  &:focus { outline: none; border-color: ${theme.color.accent}; }
  &:disabled { background: ${theme.color.canvas}; cursor: not-allowed; }
`;

export const Label = styled.label`
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: ${theme.color.inkSoft};
`;

export const Field = styled.div`
  margin-bottom: 16px;
`;

/** Inline validation message shown under a single field. */
export const FieldError = styled.p`
  margin: 6px 0 0;
  font-size: 12.5px;
  color: ${theme.color.danger};
`;

export const Card = styled.div`
  background: ${theme.color.paper};
  border: 1px solid ${theme.color.line};
  border-radius: ${theme.radius.lg};
  box-shadow: ${theme.shadow.card};
`;

export const Alert = styled.div`
  padding: 10px 14px;
  border-radius: ${theme.radius.md};
  font-size: 13.5px;
  margin-bottom: 16px;
  background: ${({ $tone }) =>
    $tone === 'success' ? theme.color.successSoft : theme.color.dangerSoft};
  color: ${({ $tone }) => ($tone === 'success' ? theme.color.success : theme.color.danger)};
`;

const spin = keyframes`to { transform: rotate(360deg); }`;

export const Spinner = styled.span`
  display: inline-block;
  width: ${({ $size }) => $size || 14}px;
  height: ${({ $size }) => $size || 14}px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
  flex-shrink: 0;
`;

export const PageTitle = styled.h1`
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
`;

export const PageSubtitle = styled.p`
  margin: 0 0 28px;
  color: ${theme.color.inkSoft};
  font-size: 14px;
`;

/** Neutral empty-state block: an invitation to act, not an apology. */
export const EmptyState = styled.div`
  text-align: center;
  padding: 44px 24px;
  color: ${theme.color.inkSoft};

  h3 {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
    color: ${theme.color.ink};
  }
  p { margin: 0; font-size: 13.5px; }
`;
