/**
 * The chat surface: message list, thinking indicator, and composer.
 *
 * UI enhanced for QueryNest.
 *
 * IMPORTANT:
 * Existing chat functionality is preserved:
 * - auto-scroll
 * - textarea auto-grow
 * - Enter to send
 * - Shift+Enter for newline
 * - loading state
 * - disabled state
 * - Markdown rendering
 * - source/citation rendering
 * - onSend behavior
 */

import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

import Markdown from './Markdown';
import Sources from './Sources';
import { Spinner } from './ui';
import { theme } from '../theme';

/* =========================================================
   MAIN WRAPPER
   ========================================================= */

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;

  flex: 1;
  min-height: 0;

  background:
    radial-gradient(
      circle at 50% 25%,
      rgba(125, 87, 244, 0.035),
      transparent 38%
    ),
    #fbfaff;
`;

/* =========================================================
   MESSAGE SCROLL AREA
   ========================================================= */

const ScrollArea = styled.div`
  flex: 1;

  min-height: 0;

  overflow-y: auto;

  padding: 34px 0 40px;

  scroll-behavior: smooth;

  /* Scrollbar */
  &::-webkit-scrollbar {
    width: 7px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #ded9ec;
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #c9c1df;
  }

  @media (max-width: 700px) {
    padding: 24px 0 30px;
  }
`;

/* =========================================================
   MESSAGE THREAD
   ========================================================= */

const Thread = styled.div`
  width: min(820px, calc(100% - 48px));

  margin: 0 auto;

  @media (max-width: 700px) {
    width: calc(100% - 28px);
  }
`;

/* =========================================================
   MESSAGE ROW
   ========================================================= */

const Row = styled.article`
  display: flex;

  align-items: flex-start;

  gap: 13px;

  margin-bottom: 28px;

  animation: messageIn 0.2s ease-out;

  @keyframes messageIn {
    from {
      opacity: 0;
      transform: translateY(5px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

/* =========================================================
   AVATAR
   ========================================================= */

const Avatar = styled.div`
  width: 34px;
  height: 34px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 11px;

  font-size: ${({ $role }) =>
    $role === 'user' ? '10px' : '17px'};

  font-weight: 700;

  background: ${({ $role }) =>
    $role === 'user'
      ? '#eeeaf7'
      : 'linear-gradient(135deg, #704cf0, #9066ff)'};

  color: ${({ $role }) =>
    $role === 'user'
      ? '#68617b'
      : '#ffffff'};

  border: ${({ $role }) =>
    $role === 'user'
      ? '1px solid #e3ddef'
      : 'none'};

  box-shadow: ${({ $role }) =>
    $role === 'user'
      ? 'none'
      : '0 7px 18px rgba(112, 76, 240, 0.18)'};
`;

/* =========================================================
   MESSAGE BODY
   ========================================================= */

const Body = styled.div`
  flex: 1;

  min-width: 0;

  padding-top: 1px;
`;

/* =========================================================
   ROLE
   ========================================================= */

const RoleName = styled.p`
  margin: 0 0 6px;

  color: #5d6480;

  font-size: 12px;

  font-weight: 700;

  letter-spacing: 0.01em;
`;

/* =========================================================
   USER MESSAGE
   ========================================================= */

const UserText = styled.div`
  width: fit-content;

  max-width: min(680px, 100%);

  margin-left: auto;

  padding: 11px 15px;

  border-radius: 16px 16px 4px 16px;

  background: #eee9ff;

  border: 1px solid #e1d9ff;

  color: #282b43;

  font-size: 14px;

  line-height: 1.6;

  white-space: pre-wrap;

  overflow-wrap: anywhere;

  @media (max-width: 700px) {
    max-width: 90%;
  }
`;

/* =========================================================
   THINKING
   ========================================================= */

const Thinking = styled.div`
  display: flex;

  align-items: center;

  gap: 10px;

  color: #777f9c;

  font-size: 13.5px;

  padding-top: 4px;
`;

/* =========================================================
   EMPTY STATE
   ========================================================= */

const EmptyState = styled.div`
  min-height: 100%;

  display: flex;

  align-items: center;

  justify-content: center;

  padding: 30px 20px 80px;

  text-align: center;
`;

const EmptyContent = styled.div`
  width: min(580px, 100%);

  margin-top: -25px;
`;

/* =========================================================
   EMPTY ICON
   ========================================================= */

const EmptyIcon = styled.div`
  width: 64px;
  height: 64px;

  margin: 0 auto 20px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 19px;

  background: linear-gradient(
    135deg,
    #eee8ff,
    #f7f4ff
  );

  border: 1px solid #e1d8ff;

  color: #7651ee;

  font-size: 28px;

  box-shadow:
    0 12px 28px rgba(111, 75, 237, 0.10);
`;

const EmptyTitle = styled.h2`
  margin: 0;

  color: #202746;

  font-size: 25px;

  line-height: 1.25;

  font-weight: 750;

  letter-spacing: -0.7px;

  @media (max-width: 600px) {
    font-size: 22px;
  }
`;

const EmptyTitleAccent = styled.span`
  display: block;

  margin-top: 3px;

  background: linear-gradient(
    90deg,
    #6845e9,
    #9369ff
  );

  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;

  background-clip: text;
`;

const EmptyHint = styled.p`
  max-width: 470px;

  margin: 13px auto 0;

  color: #8189a6;

  font-size: 13.5px;

  line-height: 1.7;
`;

/* =========================================================
   SUGGESTIONS
   ========================================================= */

const Suggestions = styled.div`
  display: flex;

  justify-content: center;

  flex-wrap: wrap;

  gap: 9px;

  margin-top: 25px;
`;

const Suggestion = styled.div`
  display: flex;

  align-items: center;

  gap: 7px;

  padding: 8px 13px;

  border-radius: 22px;

  background: rgba(255, 255, 255, 0.86);

  border: 1px solid #e5def6;

  color: #666d88;

  font-size: 11.5px;

  font-weight: 600;

  box-shadow:
    0 5px 15px rgba(72, 49, 130, 0.035);
`;

const SuggestionIcon = styled.span`
  color: #7652eb;

  font-size: 12px;
`;

/* =========================================================
   COMPOSER
   ========================================================= */

const Composer = styled.div`
  flex-shrink: 0;

  padding: 14px 24px 20px;

  background:
    linear-gradient(
      to bottom,
      rgba(251, 250, 255, 0),
      #fbfaff 18%
    );

  @media (max-width: 700px) {
    padding: 10px 14px 15px;
  }
`;

const ComposerInner = styled.div`
  width: min(820px, 100%);

  margin: 0 auto;
`;

/* =========================================================
   INPUT CONTAINER
   ========================================================= */

const InputRow = styled.div`
  display: flex;

  align-items: flex-end;

  gap: 9px;

  min-height: 54px;

  padding: 8px 8px 8px 16px;

  border-radius: 17px;

  background: #ffffff;

  border: 1px solid
    ${({ $focused }) =>
      $focused ? '#8560f2' : '#ded9ea'};

  box-shadow:
    ${({ $focused }) =>
      $focused
        ? '0 0 0 3px rgba(117, 81, 238, 0.09), 0 8px 25px rgba(77, 54, 142, 0.06)'
        : '0 5px 20px rgba(58, 43, 110, 0.045)'};

  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
`;

/* =========================================================
   TEXTAREA
   ========================================================= */

const TextArea = styled.textarea`
  flex: 1;

  min-width: 0;

  border: none;

  outline: none;

  resize: none;

  padding: 6px 0;

  max-height: 180px;

  line-height: 1.5;

  background: transparent;

  color: #282d47;

  font-family: inherit;

  font-size: 13.5px;

  &::placeholder {
    color: #a1a7ba;
  }

  &:disabled {
    background: transparent;

    cursor: not-allowed;
  }
`;

/* =========================================================
   SEND BUTTON
   ========================================================= */

const SendButton = styled.button`
  width: 38px;
  height: 38px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border: none;

  border-radius: 11px;

  background: ${({ disabled }) =>
    disabled
      ? '#e8e7ee'
      : 'linear-gradient(135deg, #704cf0, #9064ff)'};

  color: ${({ disabled }) =>
    disabled ? '#a2a3ae' : '#ffffff'};

  cursor: ${({ disabled }) =>
    disabled ? 'not-allowed' : 'pointer'};

  font-size: 19px;

  font-weight: 600;

  box-shadow: ${({ disabled }) =>
    disabled
      ? 'none'
      : '0 6px 15px rgba(111, 76, 239, 0.22)'};

  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);

    box-shadow:
      0 8px 18px rgba(111, 76, 239, 0.27);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
`;

/* =========================================================
   FOOTER HINT
   ========================================================= */

const Hint = styled.p`
  margin: 8px 0 0;

  text-align: center;

  color: #a0a5b7;

  font-size: 10.5px;

  line-height: 1.4;
`;

/* =========================================================
   COMPONENT
   ========================================================= */

export default function ChatInterface({
  messages,
  isLoading,
  onSend,
  emptyTitle = 'Ask about your documents',
  emptyHint =
    'Answers are drawn from the PDFs you have uploaded, with the source pages cited.',
  disabled = false,
  disabledHint,
}) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);

  const scrollRef = useRef(null);
  const textAreaRef = useRef(null);

  /* =========================================================
     AUTO SCROLL
     Existing behavior preserved.
     ========================================================= */

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  /* =========================================================
     TEXTAREA AUTO HEIGHT
     Existing behavior preserved.
     ========================================================= */

  useEffect(() => {
    const node = textAreaRef.current;

    if (!node) return;

    node.style.height = 'auto';

    node.style.height = `${Math.min(
      node.scrollHeight,
      180
    )}px`;
  }, [input]);

  /* =========================================================
     SEND
     Existing behavior preserved.
     ========================================================= */

  const canSend =
    input.trim() &&
    !isLoading &&
    !disabled;

  const submit = () => {
    if (!canSend) return;

    onSend(input.trim());

    setInput('');
  };

  /* =========================================================
     KEYBOARD
     Existing behavior preserved.
     ========================================================= */

  const handleKeyDown = (event) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault();

      submit();
    }
  };

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <Wrapper>

      {/* =====================================================
          MESSAGE AREA
          ===================================================== */}

      <ScrollArea ref={scrollRef}>

        {messages.length === 0 &&
        !isLoading ? (

          /* =================================================
             EMPTY STATE
             ================================================= */

          <EmptyState>
            <EmptyContent>

              <EmptyIcon>
                ✦
              </EmptyIcon>

              <EmptyTitle>
                {emptyTitle ===
                'Ask about your documents' ? (
                  <>
                    Ask about your documents
                    <EmptyTitleAccent>
                      Get clear answers.
                    </EmptyTitleAccent>
                  </>
                ) : (
                  emptyTitle
                )}
              </EmptyTitle>

              <EmptyHint>
                {emptyHint}
              </EmptyHint>

              {emptyTitle ===
                'Ask about your documents' && (
                <Suggestions>

                  <Suggestion>
                    <SuggestionIcon>
                      ✦
                    </SuggestionIcon>
                    Ask questions
                  </Suggestion>

                  <Suggestion>
                    <SuggestionIcon>
                      ✓
                    </SuggestionIcon>
                    Document citations
                  </Suggestion>

                  <Suggestion>
                    <SuggestionIcon>
                      ⊙
                    </SuggestionIcon>
                    Find information faster
                  </Suggestion>

                </Suggestions>
              )}

            </EmptyContent>
          </EmptyState>

        ) : (

          /* =================================================
             MESSAGES
             ================================================= */

          <Thread>

            {messages.map((message) => (
              <Row key={message.id}>

                <Avatar
                  $role={message.role}
                  aria-hidden="true"
                >
                  {message.role === 'user'
                    ? 'You'
                    : '✦'}
                </Avatar>

                <Body>

                  <RoleName>
                    {message.role === 'user'
                      ? 'You'
                      : 'QueryNest AI'}
                  </RoleName>

                  {message.role === 'user' ? (

                    <UserText>
                      {message.content}
                    </UserText>

                  ) : (

                    <>
                      <Markdown>
                        {message.content}
                      </Markdown>

                      <Sources
                        sources={
                          message.sources
                        }
                      />
                    </>

                  )}

                </Body>

              </Row>
            ))}

            {/* =============================================
                THINKING
                ============================================= */}

            {isLoading && (
              <Row>

                <Avatar
                  $role="assistant"
                  aria-hidden="true"
                >
                  ✦
                </Avatar>

                <Body>

                  <RoleName>
                    QueryNest AI
                  </RoleName>

                  <Thinking role="status">
                    <Spinner $size={15} />

                    <span>
                      Thinking...
                    </span>
                  </Thinking>

                </Body>

              </Row>
            )}

          </Thread>

        )}

      </ScrollArea>

      {/* =====================================================
          COMPOSER
          ===================================================== */}

      <Composer>

        <ComposerInner>

          <InputRow $focused={focused}>

            <TextArea
              ref={textAreaRef}
              rows={1}
              value={input}
              placeholder={
                disabled
                  ? disabledHint ||
                    'Upload a document to start'
                  : 'Ask a question about your documents...'
              }
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={handleKeyDown}
              onFocus={() =>
                setFocused(true)
              }
              onBlur={() =>
                setFocused(false)
              }
              disabled={
                isLoading || disabled
              }
            />

            <SendButton
              onClick={submit}
              disabled={!canSend}
              aria-label="Send question"
            >
              {isLoading ? (
                <Spinner $size={13} />
              ) : (
                <span aria-hidden="true">
                  ↑
                </span>
              )}
            </SendButton>

          </InputRow>

          <Hint>
            Answers come only from your uploaded
            documents.
          </Hint>

        </ComposerInner>

      </Composer>

    </Wrapper>
  );
}