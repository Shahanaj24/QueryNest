/**
 * Chat page (requirement 11 and 12).
 *
 * Handles:
 *   /chat
 *   /chat/:conversationId
 *
 * UI updated for QueryNest.
 *
 * IMPORTANT:
 * Chat/API/conversation/document logic is unchanged.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';

import ChatInterface from '../components/ChatInterface';
import { Spinner } from '../components/ui';
import {
  conversationApi,
  errorMessage,
  documentApi,
} from '../api/client';

import { useConversations } from '../context/ConversationContext';
import { theme } from '../theme';

/* =========================================================
   PAGE
   ========================================================= */

const Page = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;

  display: flex;
  flex-direction: column;

  background: #fbfaff;
  overflow: hidden;
`;

/* =========================================================
   CHAT HEADER
   ========================================================= */

const Header = styled.header`
  height: 62px;
  flex-shrink: 0;

  display: flex;
  align-items: center;

  padding: 0 26px;

  background: rgba(255, 255, 255, 0.92);

  border-bottom: 1px solid #ebe8f4;

  h2 {
    margin: 0;

    max-width: 700px;

    font-size: 14px;
    font-weight: 650;

    color: #20294b;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 860px) {
    height: 56px;
    padding: 0 18px;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const LogoMark = styled.div`
  width: 32px;
  height: 32px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 9px;

  background: linear-gradient(
    135deg,
    #6847eb,
    #9368ff
  );

  color: #ffffff;

  font-size: 15px;
  font-weight: 800;

  box-shadow:
    0 6px 16px rgba(104, 71, 235, 0.22);
`;

/* =========================================================
   ERROR
   ========================================================= */

const Banner = styled.div`
  margin: 12px 22px 0;

  padding: 11px 14px;

  border-radius: 10px;

  border: 1px solid #f1d7de;

  background: #fff6f8;

  color: #c04c67;

  font-size: 13px;

  line-height: 1.45;

  z-index: 2;
`;

/* =========================================================
   DOCUMENT WARNING
   ========================================================= */

const NoDocuments = styled.div`
  margin: 12px 22px 0;

  padding: 11px 14px;

  display: flex;
  align-items: center;
  gap: 9px;

  border-radius: 10px;

  border: 1px solid #e3dafa;

  background: #f5f1ff;

  color: #674bd2;

  font-size: 13px;

  line-height: 1.45;

  z-index: 2;

  a {
    color: #5e40d4;
    font-weight: 650;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  @media (max-width: 600px) {
    margin-left: 14px;
    margin-right: 14px;
  }
`;

const DocumentIcon = styled.div`
  width: 27px;
  height: 27px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 7px;

  background: #e8e0ff;

  color: #7050e8;

  font-size: 13px;
`;

/* =========================================================
   CHAT CONTENT
   ========================================================= */

const ChatArea = styled.div`
  flex: 1;
  min-height: 0;

  position: relative;

  display: flex;
  flex-direction: column;

  overflow: hidden;
`;

/* =========================================================
   LOADING
   ========================================================= */

const Centre = styled.div`
  flex: 1;

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 10px;

  color: #8c94ae;

  font-size: 13px;

  background: #fbfaff;
`;

/* =========================================================
   CHAT PAGE
   ========================================================= */

export default function Chat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const {
    conversations,
    applyConversationUpdate,
    startConversation,
  } = useConversations();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [hasDocuments, setHasDocuments] = useState(true);

  // Existing logic preserved.
  const loadToken = useRef(0);

  // Existing logic preserved.
  const hydratedId = useRef(null);

  // Existing logic preserved.
  const pendingId = useRef(null);

  const conversation = conversations.find(
    (item) => item.id === conversationId
  );

  /* =========================================================
     LOAD CONVERSATION
     ========================================================= */

  useEffect(() => {
    const token = ++loadToken.current;

    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    if (hydratedId.current === conversationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    conversationApi
      .get(conversationId)
      .then((detail) => {
        if (token !== loadToken.current) return;

        setMessages(detail.messages || []);

        hydratedId.current = conversationId;
      })
      .catch((err) => {
        if (token !== loadToken.current) return;

        setError(
          errorMessage(
            err,
            'Could not open that chat.'
          )
        );

        setMessages([]);
        hydratedId.current = null;
      })
      .finally(() => {
        if (token === loadToken.current) {
          setLoading(false);
        }
      });
  }, [conversationId]);

  /* =========================================================
     CHECK DOCUMENTS
     ========================================================= */

  useEffect(() => {
    let cancelled = false;

    documentApi
      .list()
      .then(({ documents }) => {
        if (!cancelled) {
          setHasDocuments(
            documents.some(
              (doc) => doc.status === 'processed'
            )
          );
        }
      })
      .catch(() => {
        // Existing behavior preserved.
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  /* =========================================================
     SEND MESSAGE
     ========================================================= */

  const handleSend = useCallback(
    async (content) => {
      setError('');
      setSending(true);

      const optimistic = {
        id: `pending-${Date.now()}`,
        role: 'user',
        content,
        sources: [],
      };

      setMessages((current) => [
        ...current,
        optimistic,
      ]);

      try {
        const targetId =
          conversationId ||
          pendingId.current ||
          (pendingId.current =
            (
              await startConversation()
            ).id);

        const result =
          await conversationApi.sendMessage(
            targetId,
            content
          );

        hydratedId.current = targetId;
        pendingId.current = null;

        setMessages((current) => [
          ...current.filter(
            (message) =>
              message.id !== optimistic.id
          ),
          result.userMessage,
          result.assistantMessage,
        ]);

        const known =
          conversations.find(
            (item) =>
              item.id === targetId
          );

        applyConversationUpdate({
          ...known,
          id: targetId,
          title: result.title,
          messageCount:
            (known?.messageCount || 0) + 2,
        });

        if (!conversationId) {
          navigate(
            `/chat/${targetId}`,
            { replace: true }
          );
        }
      } catch (err) {
        setMessages((current) =>
          current.filter(
            (message) =>
              message.id !== optimistic.id
          )
        );

        setError(
          errorMessage(
            err,
            'Could not get an answer. Please try again.'
          )
        );
      } finally {
        setSending(false);
      }
    },
    [
      conversationId,
      navigate,
      startConversation,
      applyConversationUpdate,
      conversations,
    ]
  );

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <Page>
        <Centre>
          <Spinner $size={16} />
          Loading conversation...
        </Centre>
      </Page>
    );
  }

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <Page>

      {/* Conversation header */}
      {conversationId && (
        <Header>
          <HeaderLeft>
            <LogoMark>Q</LogoMark>

            <h2>
              {conversation?.title || 'Chat'}
            </h2>
          </HeaderLeft>
        </Header>
      )}

      {/* Error */}
      {error && (
        <Banner role="alert">
          {error}
        </Banner>
      )}

      {/* No documents */}
      {!hasDocuments && (
        <NoDocuments>
          <DocumentIcon>▣</DocumentIcon>

          <span>
            You have no processed documents yet.{' '}
            <Link to="/documents">
              Upload a PDF
            </Link>{' '}
            to get answers based on your own files.
          </span>
        </NoDocuments>
      )}

      {/* =====================================================
          IMPORTANT:
          ChatInterface owns the empty state + messages + input.
          We don't add another empty-state here.
          ===================================================== */}

      <ChatArea>
        <ChatInterface
          messages={messages}
          isLoading={sending}
          onSend={handleSend}
          emptyTitle={
            conversationId
              ? 'Ask a follow-up'
              : 'Ask about your documents'
          }
          disabled={!hasDocuments}
          disabledHint="Upload and process a PDF first, then ask a question."
        />
      </ChatArea>

    </Page>
  );
}