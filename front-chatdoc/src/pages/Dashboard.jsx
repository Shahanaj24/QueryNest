/**
 * Dashboard
 *
 * QueryNest dashboard UI.
 *
 * IMPORTANT:
 * Existing functionality and logic are preserved:
 * - document loading
 * - document upload
 * - quick question
 * - conversation creation
 * - conversation API
 * - navigation
 * - recent chats
 * - recent documents
 * - authentication context
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import FileUpload from '../components/FileUpload';
import {
  Alert,
  Button,
  Spinner,
} from '../components/ui';

import {
  conversationApi,
  documentApi,
  errorMessage,
} from '../api/client';

import { useAuth } from '../context/AuthContext';
import { useConversations } from '../context/ConversationContext';

import {
  formatBytes,
  formatDate,
} from '../utils/format';

/* =========================================================
   PAGE
   ========================================================= */

const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;

  background:
    radial-gradient(
      circle at 82% 0%,
      rgba(115, 80, 239, 0.075),
      transparent 30%
    ),
    radial-gradient(
      circle at 10% 45%,
      rgba(145, 104, 255, 0.045),
      transparent 28%
    ),
    #faf9ff;

  &::-webkit-scrollbar {
    width: 7px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #ddd9eb;
    border-radius: 10px;
  }
`;

/* =========================================================
   CONTAINER
   ========================================================= */

const Container = styled.div`
  width: min(1120px, calc(100% - 52px));
  margin: 0 auto;
  padding: 44px 0 55px;

  @media (max-width: 850px) {
    width: calc(100% - 36px);
    padding: 32px 0 45px;
  }

  @media (max-width: 550px) {
    width: calc(100% - 26px);
    padding: 25px 0 40px;
  }
`;

/* =========================================================
   TOP BAR
   ========================================================= */

const TopBar = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 14px;
  margin-bottom: 30px;

  @media (max-width: 700px) {
    margin-bottom: 22px;
  }
`;

const TopIcon = styled.button`
  width: 38px;
  height: 38px;

  display: flex;
  align-items: center;
  justify-content: center;

  border: none;
  border-radius: 50%;

  background: ${({ $soft }) =>
    $soft ? '#f1effb' : 'transparent'};

  color: #202746;
  font-size: 18px;

  cursor: pointer;

  transition:
    background-color 0.15s ease,
    transform 0.15s ease;

  &:hover {
    background: #eeebf8;
    transform: translateY(-1px);
  }
`;

/* =========================================================
   HERO
   ========================================================= */

const Hero = styled.div`
  margin-bottom: 30px;
`;

const StyledPageTitle = styled.h1`
  margin: 0;

  color: #172044;

  font-size: 31px;
  line-height: 1.2;
  letter-spacing: -0.9px;
  font-weight: 750;

  @media (max-width: 700px) {
    font-size: 26px;
  }

  @media (max-width: 450px) {
    font-size: 23px;
  }
`;

const Wave = styled.span`
  display: inline-block;
  margin-right: 9px;
`;

const AccentText = styled.span`
  color: #172044;
`;

const StyledPageSubtitle = styled.p`
  margin: 10px 0 0;

  color: #69718e;

  font-size: 14px;
  line-height: 1.6;

  @media (max-width: 600px) {
    font-size: 13px;
  }
`;

/* =========================================================
   ERROR
   ========================================================= */

const DashboardAlert = styled(Alert)`
  margin-bottom: 20px;
`;

/* =========================================================
   ASK CARD
   ========================================================= */

const AskCard = styled.div`
  position: relative;

  padding: 12px;

  border: 1px solid #e3e0ed;
  border-radius: 18px;

  background: rgba(255, 255, 255, 0.92);

  box-shadow:
    0 8px 30px rgba(60, 47, 115, 0.055);

  overflow: hidden;

  &::before {
    content: '';

    position: absolute;

    top: -110px;
    right: -90px;

    width: 230px;
    height: 230px;

    border-radius: 50%;

    background: rgba(116, 82, 239, 0.055);

    pointer-events: none;
  }

  @media (max-width: 600px) {
    padding: 8px;
    border-radius: 15px;
  }
`;

const AskInner = styled.div`
  position: relative;

  min-height: 132px;

  padding: 14px 16px 12px;

  border: 1px solid #e5e1ef;
  border-radius: 14px;

  background: #fff;

  display: flex;
  flex-direction: column;

  @media (max-width: 600px) {
    min-height: 145px;
    padding: 12px;
  }
`;

const AskTop = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const AskIcon = styled.div`
  width: 40px;
  height: 40px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 50%;

  background: #f2efff;

  color: #7150ea;

  font-size: 18px;
`;

const AskInput = styled.input`
  flex: 1;

  min-width: 0;

  height: 40px;

  padding: 0;

  border: none;
  outline: none;

  background: transparent;

  color: #303650;

  font-family: inherit;
  font-size: 14px;

  &::placeholder {
    color: #8a91aa;
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

const AskBottom = styled.div`
  display: flex;

  align-items: center;
  justify-content: space-between;

  margin-top: auto;
  padding-top: 12px;
`;

const UploadButton = styled.div`
  display: inline-flex;

  align-items: center;
  gap: 6px;

  padding: 7px 11px;

  border-radius: 18px;

  background: #f5f3fb;
  border: 1px solid #e9e5f4;

  color: #6553a6;

  font-size: 11.5px;
  font-weight: 600;

  pointer-events: none;
`;

const AttachmentIcon = styled.span`
  font-size: 15px;
  color: #6f51df;
`;

const AskButton = styled(Button)`
  width: 45px;
  height: 45px;

  min-width: 45px;

  padding: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border: none !important;
  border-radius: 12px;

  background: linear-gradient(
    135deg,
    #6845e9 0%,
    #8560f5 100%
  ) !important;

  color: #fff !important;

  box-shadow:
    0 7px 17px rgba(103, 68, 232, 0.22);

  font-size: 21px;

  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      #5e3cdb 0%,
      #7954eb 100%
    ) !important;

    transform: translateY(-1px);

    box-shadow:
      0 9px 21px rgba(103, 68, 232, 0.28);
  }

  &:disabled {
    opacity: 0.55;
    box-shadow: none;
  }

  @media (max-width: 500px) {
    width: 42px;
    height: 42px;
    min-width: 42px;
  }
`;

/* =========================================================
   TRY ASKING
   ========================================================= */

const TryAsking = styled.div`
  margin-top: 25px;
`;

const TryTitle = styled.h3`
  margin: 0 0 11px;

  color: #242943;

  font-size: 13px;
  font-weight: 700;
`;

const Suggestions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
`;

const Suggestion = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;

  min-height: 42px;

  padding: 0 15px;

  border: 1px solid #e7e2f0;
  border-radius: 22px;

  background: rgba(255, 255, 255, 0.9);

  color: #535a78;

  font-size: 11.5px;
  font-weight: 600;

  box-shadow:
    0 2px 8px rgba(67, 53, 112, 0.025);

  white-space: nowrap;

  @media (max-width: 700px) {
    min-height: 38px;
    padding: 0 12px;
    font-size: 11px;
  }

  @media (max-width: 500px) {
    flex: 1;
    justify-content: center;
  }
`;

const SuggestionIcon = styled.span`
  color: #6849e5;
  font-size: 16px;
`;

/* =========================================================
   UPLOAD SECTION
   ========================================================= */

const UploadSection = styled.section`
  margin-top: 27px;
`;

const UploadBox = styled.div`
  position: relative;

  min-height: 150px;

  padding: 3px;

  border: 1px dashed #cfc7e6;
  border-radius: 15px;

  background:
    linear-gradient(
      135deg,
      rgba(247, 245, 255, 0.96),
      rgba(251, 250, 255, 0.96)
    );

  overflow: hidden;

  display: flex;
  align-items: center;
  justify-content: center;

  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;

  &:hover {
    border-color: #b8a8e7;

    background:
      linear-gradient(
        135deg,
        #f7f4ff,
        #fcfbff
      );
  }

  @media (max-width: 600px) {
    min-height: 135px;
  }
`;

const UploadContent = styled.div`
  width: 100%;
  text-align: center;
`;

/*
 * FileUpload remains the actual upload component.
 * These styles make the surrounding area blend with the new dashboard.
 */
const UploadComponentWrapper = styled.div`
  width: 100%;

  display: flex;
  justify-content: center;

  & > * {
    width: 100%;
  }

  /*
   * These selectors help the existing FileUpload component
   * visually blend into the dashboard without changing its logic.
   */
  button {
    font-family: inherit;
  }
`;

/* =========================================================
   RECENT AREA
   ========================================================= */

const RecentGrid = styled.div`
  display: grid;

  grid-template-columns: 1fr 1fr;

  gap: 18px;

  margin-top: 27px;

  @media (max-width: 850px) {
    grid-template-columns: 1fr;
  }
`;

const RecentCard = styled.section`
  min-width: 0;

  border: 1px solid #e6e1ef;
  border-radius: 16px;

  background: rgba(255, 255, 255, 0.96);

  box-shadow:
    0 5px 22px rgba(65, 52, 110, 0.045);

  overflow: hidden;
`;

const RecentHeader = styled.div`
  height: 50px;

  display: flex;

  align-items: center;
  justify-content: space-between;

  padding: 0 16px;

  border-bottom: 1px solid #eeeaf4;

  h2 {
    display: flex;
    align-items: center;
    gap: 9px;

    margin: 0;

    color: #242842;

    font-size: 13px;
    font-weight: 700;
  }

  a {
    color: #6c4ce2;

    font-size: 10.5px;
    font-weight: 600;

    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const HeaderIcon = styled.span`
  color: #6849df;
  font-size: 16px;
`;

const List = styled.div`
  padding: 7px;
`;

const Row = styled(Link)`
  display: flex;

  align-items: center;
  justify-content: space-between;

  min-height: 62px;

  padding: 8px 9px;

  border-radius: 11px;

  text-decoration: none;

  color: #292e47;

  transition:
    background-color 0.15s ease,
    transform 0.15s ease;

  &:hover {
    background: #faf8ff;
    transform: translateX(1px);
  }

  & + & {
    border-top: 1px solid #f1eef6;
  }
`;

const RowLeft = styled.div`
  display: flex;

  align-items: center;

  gap: 11px;

  min-width: 0;
`;

const RowIcon = styled.div`
  width: 38px;
  height: 38px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 50%;

  background: ${({ $document }) =>
    $document ? '#f5eefe' : '#f4f1fc'};

  color: ${({ $document }) =>
    $document ? '#8d50dd' : '#6752d9'};

  font-size: ${({ $document }) =>
    $document ? '15px' : '17px'};
`;

const PdfBadge = styled.div`
  width: 30px;
  height: 30px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 8px;

  background: #f0445d;

  color: #fff;

  font-size: 8px;
  font-weight: 800;

  box-shadow:
    0 4px 10px rgba(240, 68, 93, 0.16);
`;

const RowMain = styled.div`
  min-width: 0;

  p {
    margin: 0;

    color: #303650;

    font-size: 11.5px;
    font-weight: 650;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  span {
    display: block;

    margin-top: 4px;

    color: #9298ad;

    font-size: 9.5px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const RowRight = styled.div`
  flex-shrink: 0;

  display: flex;
  align-items: center;
  gap: 10px;

  margin-left: 10px;
`;

const DateText = styled.span`
  color: #969caf !important;

  font-size: 9px !important;

  text-align: right;

  white-space: nowrap !important;
`;

const RowArrow = styled.span`
  color: #596078;

  font-size: 18px;

  transition: color 0.15s ease;

  ${Row}:hover & {
    color: #6949e5;
  }
`;

const Status = styled.span`
  display: inline-flex !important;

  align-items: center;

  margin-left: 5px;

  padding: 2px 6px;

  border-radius: 8px;

  background: #f3f1f8;

  color: #858ba1 !important;

  font-size: 8px !important;
  font-weight: 600;
`;

const Muted = styled.p`
  margin: 0;

  padding: 25px 15px;

  text-align: center;

  color: #989db0;

  font-size: 11px;

  background: #fff;
`;

/* =========================================================
   FOOT NOTE
   ========================================================= */

const PrivacyNote = styled.div`
  display: flex;

  align-items: center;
  justify-content: center;

  gap: 7px;

  margin-top: 28px;

  color: #a1a6b7;

  font-size: 9.5px;

  text-align: center;
`;

const PrivacyIcon = styled.span`
  color: #7357cf;
`;

/* =========================================================
   COMPONENT
   ========================================================= */

const RECENT_LIMIT = 4;

export default function Dashboard() {
  const { user } = useAuth();

  const {
    conversations,
    startConversation,
    applyConversationUpdate,
  } = useConversations();

  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  const [error, setError] = useState('');

  /* =========================================================
     LOAD DOCUMENTS
     Existing logic preserved.
     ========================================================= */

  const loadDocuments = useCallback(async () => {
    setLoadingDocuments(true);

    try {
      const { documents: list } =
        await documentApi.list();

      setDocuments(list);

      setError('');
    } catch (err) {
      setError(
        errorMessage(
          err,
          'Could not load your documents.'
        )
      );
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  /* =========================================================
     QUICK QUESTION
     Existing logic preserved.
     ========================================================= */

  const handleAsk = async (event) => {
    event.preventDefault();

    const content = question.trim();

    if (!content || asking) return;

    setError('');
    setAsking(true);

    try {
      const conversation =
        await startConversation();

      const result =
        await conversationApi.sendMessage(
          conversation.id,
          content
        );

      applyConversationUpdate({
        ...conversation,
        id: conversation.id,
        title: result.title,
        messageCount: 2,
      });

      setQuestion('');

      navigate(
        `/chat/${conversation.id}`
      );
    } catch (err) {
      setError(
        errorMessage(
          err,
          'Could not start that chat.'
        )
      );
    } finally {
      setAsking(false);
    }
  };

  /* =========================================================
     DERIVED DATA
     ========================================================= */

  const hasProcessedDocument =
    documents.some(
      (doc) => doc.status === 'processed'
    );

  const recentChats =
    conversations.slice(
      0,
      RECENT_LIMIT
    );

  const recentDocuments =
    documents.slice(
      0,
      RECENT_LIMIT
    );

  /* =========================================================
     UI
     ========================================================= */

  return (
    <Scroll>
      <Container>

        {/* ===================================================
            TOP ICONS
            =================================================== */}

        <TopBar>
          <TopIcon
            type="button"
            aria-label="Notifications"
          >
            ♧
          </TopIcon>

          <TopIcon
            type="button"
            aria-label="Appearance"
            $soft
          >
            ☼
          </TopIcon>
        </TopBar>

        {/* ===================================================
            HERO
            =================================================== */}

        <Hero>
          <StyledPageTitle>
            <Wave aria-hidden="true">👋</Wave>
            Good afternoon,{' '}
            <AccentText>
              {user?.name?.split(' ')[0] ||
                'there'}
            </AccentText>
            !
          </StyledPageTitle>

          <StyledPageSubtitle>
            Ask questions about your documents and
            get accurate answers, with citations.
          </StyledPageSubtitle>
        </Hero>

        {/* ===================================================
            ERROR
            =================================================== */}

        {error && (
          <DashboardAlert role="alert">
            {error}
          </DashboardAlert>
        )}

        {/* ===================================================
            ASK QUESTION
            =================================================== */}

        <AskCard>
          <AskInner>

            <AskTop>
              <AskIcon aria-hidden="true">
                ✦
              </AskIcon>

              <AskInput
                value={question}
                onChange={(event) =>
                  setQuestion(
                    event.target.value
                  )
                }
                placeholder={
                  hasProcessedDocument
                    ? 'Ask anything about your documents...'
                    : 'Upload a document to start asking questions'
                }
                disabled={
                  asking ||
                  !hasProcessedDocument
                }
                aria-label="Ask a question about your documents"
              />
            </AskTop>

            <AskBottom>

              <UploadButton>
                <AttachmentIcon>
                  ♧
                </AttachmentIcon>
                Upload PDF
              </UploadButton>

              <AskButton
                type="button"
                onClick={(event) => {
                  handleAsk({
                    preventDefault: () => {},
                  });
                }}
                disabled={
                  asking ||
                  !question.trim() ||
                  !hasProcessedDocument
                }
                aria-label="Ask question"
              >
                {asking ? (
                  <Spinner />
                ) : (
                  '➤'
                )}
              </AskButton>

            </AskBottom>

          </AskInner>
        </AskCard>

        {/* ===================================================
            TRY ASKING
            =================================================== */}

        <TryAsking>

          <TryTitle>
            Try asking
          </TryTitle>

          <Suggestions>

            <Suggestion>
              <SuggestionIcon>
                ▧
              </SuggestionIcon>
              Summarize my document
            </Suggestion>

            <Suggestion>
              <SuggestionIcon>
                ♧
              </SuggestionIcon>
              Explain the key points
            </Suggestion>

            <Suggestion>
              <SuggestionIcon>
                ⌕
              </SuggestionIcon>
              Find important topics
            </Suggestion>

            <Suggestion>
              <SuggestionIcon>
                ✦
              </SuggestionIcon>
              Answer a specific question
            </Suggestion>

          </Suggestions>

        </TryAsking>

        {/* ===================================================
            DOCUMENT UPLOAD
            =================================================== */}

        <UploadSection>

          <UploadBox>

            <UploadContent>

              <UploadComponentWrapper>
                <FileUpload
                  onUploaded={
                    loadDocuments
                  }
                />
              </UploadComponentWrapper>

            </UploadContent>

          </UploadBox>

        </UploadSection>

        {/* ===================================================
            RECENT CHATS + DOCUMENTS
            =================================================== */}

        <RecentGrid>

          {/* =================================================
              RECENT CHATS
              ================================================= */}

          <RecentCard>

            <RecentHeader>

              <h2>
                <HeaderIcon>
                  ♧
                </HeaderIcon>
                Recent Chats
              </h2>

              <Link to="/chat">
                View all →
              </Link>

            </RecentHeader>

            {recentChats.length === 0 ? (

              <Muted>
                No conversations yet.
                Ask your first question above.
              </Muted>

            ) : (

              <List>

                {recentChats.map(
                  (conversation) => (

                    <Row
                      key={conversation.id}
                      to={`/chat/${conversation.id}`}
                    >

                      <RowLeft>

                        <RowIcon
                          aria-hidden="true"
                        >
                          ♧
                        </RowIcon>

                        <RowMain>

                          <p>
                            {conversation.title}
                          </p>

                          <span>
                            {conversation.messageCount}{' '}
                            message
                            {conversation.messageCount === 1
                              ? ''
                              : 's'}
                            {' · '}
                            {formatDate(
                              conversation.updatedAt
                            )}
                          </span>

                        </RowMain>

                      </RowLeft>

                      <RowRight>
                        <DateText>
                          {formatDate(
                            conversation.updatedAt
                          )}
                        </DateText>

                        <RowArrow
                          aria-hidden="true"
                        >
                          ›
                        </RowArrow>
                      </RowRight>

                    </Row>

                  )
                )}

              </List>

            )}

          </RecentCard>

          {/* =================================================
              RECENT DOCUMENTS
              ================================================= */}

          <RecentCard>

            <RecentHeader>

              <h2>
                <HeaderIcon>
                  ▧
                </HeaderIcon>
                Recent Documents
              </h2>

              <Link to="/documents">
                View all →
              </Link>

            </RecentHeader>

            {loadingDocuments ? (

              <Muted>
                Loading documents...
              </Muted>

            ) : recentDocuments.length === 0 ? (

              <Muted>
                No documents yet.
                Upload a PDF to get started.
              </Muted>

            ) : (

              <List>

                {recentDocuments.map(
                  (doc) => (

                    <Row
                      key={doc.id}
                      to="/documents"
                    >

                      <RowLeft>

                        <PdfBadge>
                          PDF
                        </PdfBadge>

                        <RowMain>

                          <p>
                            {doc.filename}
                          </p>

                          <span>
                            {formatBytes(
                              doc.fileSize
                            )}
                            {' · '}
                            Uploaded{' '}
                            {formatDate(
                              doc.uploadedAt
                            )}

                            {doc.status !==
                              'processed' && (
                              <Status>
                                {doc.status}
                              </Status>
                            )}
                          </span>

                        </RowMain>

                      </RowLeft>

                      <RowRight>

                        <DateText>
                          {formatBytes(
                            doc.fileSize
                          )}
                        </DateText>

                        <RowArrow
                          aria-hidden="true"
                        >
                          ⋮
                        </RowArrow>

                      </RowRight>

                    </Row>

                  )
                )}

              </List>

            )}

          </RecentCard>

        </RecentGrid>

        {/* ===================================================
            FOOT NOTE
            =================================================== */}

        <PrivacyNote>
          <PrivacyIcon>
            ✦
          </PrivacyIcon>

          Answers are generated only from your
          uploaded documents.
        </PrivacyNote>

      </Container>
    </Scroll>
  );
}