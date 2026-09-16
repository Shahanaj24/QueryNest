/**
 * Documents page (requirement 7).
 *
 * UI enhanced for QueryNest.
 * Existing upload, list, status, delete and API logic is preserved.
 */

import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import FileUpload from '../components/FileUpload';
import {
  Alert,
  Button,
  EmptyState,
  PageSubtitle,
  PageTitle,
  Spinner,
} from '../components/ui';
import { documentApi, errorMessage } from '../api/client';
import { theme } from '../theme';
import { formatBytes, formatDateTime } from '../utils/format';

const Scroll = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  background:
    radial-gradient(circle at 90% 5%, rgba(124, 92, 255, 0.12), transparent 28%),
    radial-gradient(circle at 10% 90%, rgba(124, 92, 255, 0.07), transparent 25%),
    #f8f7ff;
`;

const Container = styled.div`
  width: min(100%, 1040px);
  margin: 0 auto;
  padding: 42px 32px 70px;

  @media (max-width: 700px) {
    padding: 28px 18px 50px;
  }
`;

/* -------------------------------------------------------
   Header
------------------------------------------------------- */

const HeaderArea = styled.div`
  margin-bottom: 28px;
`;

const BrandRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
`;

const LogoMark = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #7052f5, #916cff);
  color: white;
  font-size: 20px;
  font-weight: 800;
  box-shadow: 0 8px 22px rgba(112, 82, 245, 0.25);
`;

const BrandName = styled.div`
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -0.03em;
  color: #17204a;

  span {
    color: #7656f6;
  }
`;

const TitleWrap = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;

  @media (max-width: 650px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const TitleGroup = styled.div`
  min-width: 0;
`;

/* -------------------------------------------------------
   Upload
------------------------------------------------------- */

const UploadSection = styled.section`
  margin-bottom: 36px;
`;

const SectionTitle = styled.h2`
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 700;
  color: #1b2045;
`;

const SectionHint = styled.p`
  margin: 0 0 15px;
  font-size: 13px;
  color: #777c9c;
`;

const UploadCard = styled.div`
  padding: 5px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(126, 102, 245, 0.14);
  box-shadow:
    0 18px 45px rgba(47, 38, 103, 0.07),
    0 2px 8px rgba(47, 38, 103, 0.03);

  & > * {
    border-radius: 18px;
  }
`;

/* -------------------------------------------------------
   Documents header
------------------------------------------------------- */

const DocumentsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;

  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: #1b2045;
  }

  span {
    font-size: 12.5px;
    color: #8589a5;
  }
`;

/* -------------------------------------------------------
   Document list
------------------------------------------------------- */

const Grid = styled.div`
  display: grid;
  gap: 12px;
`;

const DocumentCard = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 16px 18px;

  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e9e6f5;
  border-radius: 17px;

  box-shadow: 0 5px 20px rgba(47, 38, 103, 0.035);

  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: #d9d1ff;
    box-shadow: 0 12px 28px rgba(75, 59, 150, 0.08);
  }

  @media (max-width: 600px) {
    flex-wrap: wrap;
  }
`;

const Icon = styled.div`
  width: 46px;
  height: 46px;
  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 14px;

  background: linear-gradient(
    145deg,
    #f0ebff,
    #e6ddff
  );

  color: #7254f4;
  font-size: 20px;

  box-shadow: inset 0 0 0 1px rgba(119, 85, 245, 0.08);
`;

const Meta = styled.div`
  flex: 1;
  min-width: 0;

  p {
    margin: 0 0 5px;

    font-size: 14px;
    font-weight: 650;
    color: #202544;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  span {
    font-size: 12px;
    color: #8589a5;
  }
`;

const Status = styled.span`
  flex-shrink: 0;

  padding: 5px 11px;
  border-radius: 999px;

  font-size: 11px;
  font-weight: 650;

  background: ${({ $status }) => {
    if ($status === 'processed') return '#eeeaff';
    if ($status === 'failed') return '#ffe9ec';
    return '#f0f0f5';
  }};

  color: ${({ $status }) => {
    if ($status === 'processed') return '#7052ed';
    if ($status === 'failed') return '#d65363';
    return '#777b91';
  }};

  @media (max-width: 600px) {
    margin-left: 61px;
  }
`;

const DeleteButton = styled(Button)`
  flex-shrink: 0;

  @media (max-width: 600px) {
    margin-left: auto;
  }
`;

/* -------------------------------------------------------
   Loading
------------------------------------------------------- */

const Centre = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  padding: 45px 20px;

  color: #8589a5;
  font-size: 13.5px;

  background: rgba(255, 255, 255, 0.75);
  border: 1px dashed #ddd8f0;
  border-radius: 17px;
`;

/* -------------------------------------------------------
   Empty state wrapper
------------------------------------------------------- */

const EmptyWrapper = styled.div`
  padding: 5px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
`;

/* -------------------------------------------------------
   Component
------------------------------------------------------- */

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { documents: list } = await documentApi.list();
      setDocuments(list);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your documents.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Existing upload logic preserved.
  const handleUploaded = useCallback(
    (uploaded) => {
      setError('');
      setNotice(`${uploaded.filename} is ready to query.`);
      load();
    },
    [load],
  );

  // Existing delete logic preserved.
  const handleDelete = async (target) => {
    const confirmed = window.confirm(
      `Delete "${target.filename}"? Its content will no longer be searchable.`,
    );

    if (!confirmed) return;

    setDeletingId(target.id);
    setError('');

    try {
      await documentApi.remove(target.id);

      setDocuments((current) =>
        current.filter((item) => item.id !== target.id),
      );

      setNotice(`${target.filename} was deleted.`);
    } catch (err) {
      setError(errorMessage(err, 'Could not delete that document.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Scroll>
      <Container>

        {/* QueryNest branding */}
        <HeaderArea>
          <BrandRow>
            <LogoMark aria-hidden="true">Q</LogoMark>

            <BrandName>
              Query<span>Nest</span>
            </BrandName>
          </BrandRow>

          <TitleWrap>
            <TitleGroup>
              <PageTitle>My Documents</PageTitle>

              <PageSubtitle>
                Upload your PDFs and keep all your searchable documents in one place.
              </PageSubtitle>
            </TitleGroup>
          </TitleWrap>
        </HeaderArea>

        {error && <Alert role="alert">{error}</Alert>}

        {notice && !error && (
          <Alert $tone="success">{notice}</Alert>
        )}

        {/* Upload area */}
        <UploadSection>
          <SectionTitle>Upload a document</SectionTitle>

          <SectionHint>
            Add a PDF to ask questions and get answers directly from your document.
          </SectionHint>

          <UploadCard>
            <FileUpload onUploaded={handleUploaded} />
          </UploadCard>
        </UploadSection>

        {/* Document list */}
        <section>
          <DocumentsHeader>
            <h2>Your documents</h2>

            <span>
              {documents.length}{' '}
              {documents.length === 1 ? 'document' : 'documents'}
            </span>
          </DocumentsHeader>

          {loading ? (
            <Centre>
              <Spinner $size={16} />
              Loading documents...
            </Centre>
          ) : documents.length === 0 ? (
            <EmptyWrapper>
              <EmptyState>
                <h3>No documents yet</h3>
                <p>
                  Upload a PDF above and it will appear here once processed.
                </p>
              </EmptyState>
            </EmptyWrapper>
          ) : (
            <Grid>
              {documents.map((doc) => (
                <DocumentCard key={doc.id}>

                  <Icon aria-hidden="true">
                    📄
                  </Icon>

                  <Meta>
                    <p title={doc.filename}>
                      {doc.filename}
                    </p>

                    <span>
                      {formatBytes(doc.fileSize)}
                      {' · '}
                      {formatDateTime(doc.uploadedAt)}
                      {doc.pageCount
                        ? ` · ${doc.pageCount} pages`
                        : ''}
                    </span>
                  </Meta>

                  <Status $status={doc.status}>
                    {doc.status === 'processed'
                      ? 'Ready'
                      : doc.status}
                  </Status>

                  <DeleteButton
                    $variant="danger"
                    $size="sm"
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                  >
                    {deletingId === doc.id ? (
                      <Spinner $size={12} />
                    ) : (
                      'Delete'
                    )}
                  </DeleteButton>

                </DocumentCard>
              ))}
            </Grid>
          )}
        </section>

      </Container>
    </Scroll>
  );
}