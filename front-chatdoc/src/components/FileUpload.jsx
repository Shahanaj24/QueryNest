/**
 * PDF upload via drag-and-drop.
 *
 * Kept from the original component: react-dropzone, the same onDrop pattern,
 * and the styled dropzone that changes colour while dragging.
 *
 * Added: real upload through the shared API client (so the token is sent),
 * visible staged progress, and visible error messages. The original reported
 * failures only to the browser console, so a failed upload looked successful.
 */

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import styled from 'styled-components';
import { documentApi, errorMessage } from '../api/client';
import { theme } from '../theme';
import { Spinner } from './ui';

const DropzoneContainer = styled.div`
  border: 1.5px dashed
    ${({ $isDragActive, $tone }) => {
      if ($tone === 'error') return theme.color.danger;
      if ($tone === 'success') return theme.color.success;
      return $isDragActive ? theme.color.accent : theme.color.line;
    }};
  border-radius: ${theme.radius.lg};
  padding: 26px 20px;
  text-align: center;
  cursor: ${({ $busy }) => ($busy ? 'default' : 'pointer')};
  background: ${({ $isDragActive }) => ($isDragActive ? theme.color.accentSoft : theme.color.paper)};
  transition: border-color 0.15s ease, background-color 0.15s ease;

  &:hover {
    border-color: ${({ $busy }) => ($busy ? undefined : theme.color.accent)};
  }
`;

const Primary = styled.p`
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 500;
  color: ${theme.color.ink};
`;

const Secondary = styled.p`
  margin: 0;
  font-size: 12.5px;
  color: ${theme.color.inkFaint};
`;

const Status = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  font-size: 14px;
  color: ${({ $tone }) => {
    if ($tone === 'error') return theme.color.danger;
    if ($tone === 'success') return theme.color.success;
    return theme.color.inkSoft;
  }};
`;

const ProgressTrack = styled.div`
  height: 3px;
  margin-top: 14px;
  background: ${theme.color.lineSoft};
  border-radius: ${theme.radius.pill};
  overflow: hidden;
`;

const ProgressBar = styled.div`
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  background: ${theme.color.accent};
  transition: width 0.25s ease;
`;

const IDLE = { stage: 'idle', message: '' };

export default function FileUpload({ onUploaded }) {
  const [state, setState] = useState(IDLE);
  const [percent, setPercent] = useState(0);

  const busy = state.stage === 'uploading' || state.stage === 'processing';

  const onDrop = useCallback(
    async (acceptedFiles, fileRejections) => {
      if (fileRejections?.length) {
        setState({ stage: 'error', message: 'Only PDF files can be uploaded.' });
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      setPercent(0);
      setState({ stage: 'uploading', message: `Uploading ${file.name}...` });

      try {
        const result = await documentApi.upload(file, (value) => {
          setPercent(value);
          // Once the bytes are sent, the backend is extracting text and
          // building embeddings, which is the slow part.
          if (value >= 100) {
            setState({ stage: 'processing', message: 'Processing document and creating embeddings...' });
          }
        });

        setState({ stage: 'success', message: `${result.document.filename} is ready` });
        onUploaded?.(result.document);

        // Return to the idle prompt so another file can be added.
        setTimeout(() => setState(IDLE), 4000);
      } catch (error) {
        setState({ stage: 'error', message: errorMessage(error, 'That upload did not work.') });
      } finally {
        setPercent(0);
      }
    },
    [onUploaded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false,
    onDrop,
    disabled: busy,
  });

  const tone =
    state.stage === 'error' ? 'error' : state.stage === 'success' ? 'success' : undefined;

  return (
    <DropzoneContainer {...getRootProps()} $isDragActive={isDragActive} $tone={tone} $busy={busy}>
      <input {...getInputProps()} />

      {busy && (
        <>
          <Status>
            <Spinner />
            <span>{state.message}</span>
          </Status>
          <ProgressTrack>
            <ProgressBar $percent={state.stage === 'processing' ? 100 : percent} />
          </ProgressTrack>
        </>
      )}

      {state.stage === 'success' && <Status $tone="success">✓ {state.message}</Status>}

      {state.stage === 'error' && (
        <>
          <Status $tone="error">{state.message}</Status>
          <Secondary style={{ marginTop: 6 }}>Click or drop a file to try again</Secondary>
        </>
      )}

      {state.stage === 'idle' && (
        <>
          <Primary>
            {isDragActive ? 'Drop the PDF to upload' : 'Drop a PDF here, or click to choose one'}
          </Primary>
          <Secondary>PDF only, up to 20 MB</Secondary>
        </>
      )}
    </DropzoneContainer>
  );
}
