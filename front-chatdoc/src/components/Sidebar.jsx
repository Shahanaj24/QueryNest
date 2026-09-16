/**
 * Application sidebar: new chat, recent chats, and navigation.
 *
 * UI redesigned for QueryNest.
 *
 * IMPORTANT:
 * All existing conversation, navigation, delete, logout and authentication
 * logic is preserved.
 */

import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { useConversations } from '../context/ConversationContext';
import { theme } from '../theme';
import { Alert, Spinner } from './ui';

/* =========================================================
   SIDEBAR
   ========================================================= */

const Aside = styled.aside`
  width: 270px;
  flex-shrink: 0;

  display: flex;
  flex-direction: column;

  background:
    linear-gradient(
      180deg,
      #fbfaff 0%,
      #f7f5ff 100%
    );

  border-right: 1px solid #e7e3f5;

  position: relative;

  @media (max-width: 860px) {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 30;

    transform: translateX(
      ${({ $open }) => ($open ? '0' : '-100%')}
    );

    transition: transform 0.25s ease;

    box-shadow:
      ${({ $open }) =>
        $open
          ? '0 20px 60px rgba(57, 43, 120, 0.18)'
          : 'none'};
  }
`;

/* =========================================================
   BRAND
   ========================================================= */

const Brand = styled.div`
  padding: 22px 20px 20px;

  display: flex;
  align-items: center;
  gap: 11px;
`;

const LogoMark = styled.div`
  width: 38px;
  height: 38px;

  flex-shrink: 0;

  border-radius: 11px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: linear-gradient(
    135deg,
    #6d4df4,
    #916bff
  );

  box-shadow:
    0 8px 18px rgba(109, 77, 244, 0.22);
`;

const LogoSvg = styled.svg`
  width: 25px;
  height: 25px;
`;

const BrandName = styled.div`
  font-size: 18px;
  font-weight: 800;

  letter-spacing: -0.5px;

  color: #172554;

  span {
    background: linear-gradient(
      90deg,
      #6948ef,
      #8b5cf6
    );

    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
`;

/* =========================================================
   NEW CHAT
   ========================================================= */

const NewChatButton = styled.button`
  margin: 2px 16px 22px;

  min-height: 45px;

  padding: 0 14px;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;

  border: none;

  border-radius: 11px;

  background: linear-gradient(
    90deg,
    #6b49ef,
    #8961f7
  );

  color: white;

  font-size: 13.5px;
  font-weight: 700;

  cursor: pointer;

  box-shadow:
    0 9px 20px rgba(105, 72, 239, 0.22);

  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);

    box-shadow:
      0 12px 25px rgba(105, 72, 239, 0.28);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const PlusIcon = styled.span`
  width: 20px;
  height: 20px;

  border-radius: 6px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: rgba(255, 255, 255, 0.18);

  font-size: 17px;
  font-weight: 400;

  line-height: 1;
`;

/* =========================================================
   ALERT
   ========================================================= */

const SidebarAlert = styled(Alert)`
  margin: -8px 14px 14px;

  font-size: 12px;
  line-height: 1.4;
`;

/* =========================================================
   RECENT CHATS
   ========================================================= */

const RecentHeader = styled.div`
  padding: 0 18px 9px;

  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SectionLabel = styled.p`
  margin: 0;

  font-size: 11px;

  font-weight: 700;

  text-transform: uppercase;

  letter-spacing: 0.08em;

  color: #9299b8;
`;

const ChatList = styled.nav`
  flex: 1;

  overflow-y: auto;

  padding: 0 10px;

  min-height: 0;

  scrollbar-width: thin;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-thumb {
    background: #dcd7ef;
    border-radius: 10px;
  }
`;

const ChatRow = styled.div`
  display: flex;
  align-items: center;

  margin-bottom: 3px;

  border-radius: 10px;

  background: ${({ $active }) =>
    $active
      ? 'rgba(119, 82, 245, 0.10)'
      : 'transparent'};

  border: 1px solid
    ${({ $active }) =>
      $active
        ? 'rgba(119, 82, 245, 0.08)'
        : 'transparent'};

  transition:
    background 0.15s ease,
    border 0.15s ease;

  &:hover {
    background: rgba(119, 82, 245, 0.07);
  }

  &:hover button {
    opacity: 1;
  }
`;

const ChatIcon = styled.div`
  width: 28px;
  height: 28px;

  margin-left: 6px;

  flex-shrink: 0;

  border-radius: 8px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: ${({ $active }) =>
    $active
      ? '#e8e1ff'
      : '#f0eef8'};

  color: #7554ed;

  font-size: 12px;
`;

const ChatLink = styled(NavLink)`
  flex: 1;

  min-width: 0;

  padding: 10px 8px;

  font-size: 12.5px;

  font-weight: ${({ $active }) =>
    $active ? '600' : '500'};

  color: #354067;

  text-decoration: none;

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;
`;

const DeleteButton = styled.button`
  opacity: 0;

  width: 28px;
  height: 28px;

  margin-right: 5px;

  display: flex;
  align-items: center;
  justify-content: center;

  border: none;

  background: transparent;

  color: #a1a7c0;

  cursor: pointer;

  border-radius: 7px;

  font-size: 16px;

  line-height: 1;

  transition:
    color 0.15s ease,
    background 0.15s ease,
    opacity 0.15s ease;

  &:hover {
    color: #e05b70;
    background: rgba(224, 91, 112, 0.08);
  }

  &:focus-visible {
    opacity: 1;
  }
`;

const Empty = styled.p`
  padding: 10px 12px;

  margin: 0;

  font-size: 12px;

  color: #9ba2be;
`;

/* =========================================================
   BOTTOM NAVIGATION
   ========================================================= */

const Footer = styled.div`
  padding: 12px 10px 8px;

  border-top: 1px solid #e8e4f2;

  background: rgba(250, 249, 255, 0.75);
`;

const FooterLink = styled(NavLink)`
  display: flex;
  align-items: center;
  gap: 11px;

  padding: 9px 11px;

  margin-bottom: 2px;

  border-radius: 9px;

  font-size: 12.5px;

  font-weight: 500;

  color: #536083;

  text-decoration: none;

  transition:
    background 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: rgba(119, 82, 245, 0.07);
    color: #6042dc;
  }

  &.active {
    background: rgba(119, 82, 245, 0.09);
    color: #6545e5;
    font-weight: 650;
  }
`;

const NavIcon = styled.span`
  width: 26px;
  height: 26px;

  flex-shrink: 0;

  border-radius: 7px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: #efecfa;

  font-size: 13px;

  color: #7050e9;

  ${FooterLink}.active & {
    background: #e6dfff;
  }
`;

const LogoutButton = styled.button`
  width: 100%;

  display: flex;
  align-items: center;
  gap: 11px;

  padding: 9px 11px;

  border: none;

  background: transparent;

  border-radius: 9px;

  font-size: 12.5px;

  font-weight: 500;

  color: #536083;

  cursor: pointer;

  text-align: left;

  transition:
    background 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: rgba(224, 91, 112, 0.07);
    color: #d05269;
  }
`;

const LogoutIcon = styled.span`
  width: 26px;
  height: 26px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 7px;

  background: #f1eef8;

  color: #7352e8;

  font-size: 13px;

  ${LogoutButton}:hover & {
    background: #fdecef;
    color: #d05269;
  }
`;

/* =========================================================
   USER PROFILE
   ========================================================= */

const UserStrip = styled.div`
  margin-top: 8px;

  padding: 11px 9px 7px;

  border-top: 1px solid #e8e4f2;

  display: flex;
  align-items: center;
  gap: 10px;
`;

const Initial = styled.div`
  width: 34px;
  height: 34px;

  flex-shrink: 0;

  border-radius: 50%;

  display: flex;
  align-items: center;
  justify-content: center;

  background: linear-gradient(
    135deg,
    #7352e8,
    #319d91
  );

  color: white;

  font-size: 13px;

  font-weight: 700;

  box-shadow:
    0 4px 10px rgba(32, 125, 115, 0.15);
`;

const UserMeta = styled.div`
  min-width: 0;

  flex: 1;

  p {
    margin: 0 0 2px;

    font-size: 12.5px;

    font-weight: 700;

    color: #252e4d;

    white-space: nowrap;

    overflow: hidden;

    text-overflow: ellipsis;
  }

  span {
    display: block;

    font-size: 10.5px;

    color: #8c94b1;

    white-space: nowrap;

    overflow: hidden;

    text-overflow: ellipsis;
  }
`;

const UserDot = styled.div`
  width: 7px;
  height: 7px;

  border-radius: 50%;

  background: #7352e8;

  box-shadow:
    0 0 0 3px rgba(56, 183, 141, 0.12);
`;

/* =========================================================
   LOGO
   ========================================================= */

function QueryNestLogo() {
  return (
    <LogoMark>
      <LogoSvg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M7 25C9 30 14 33 20 33C27 33 33 29 35 23"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <path
          d="M9 20C11 25 15 28 21 28C27 28 32 25 34 20"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <path
          d="M12 16C13 11 17 8 21 8C25 8 28 11 28 15"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <circle
          cx="28"
          cy="14"
          r="3"
          fill="white"
        />

        <path
          d="M15 17C16 20 18 22 21 22C24 22 27 20 28 17"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </LogoSvg>
    </LogoMark>
  );
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function Sidebar({ open, onNavigate }) {
  const { user, logout } = useAuth();

  const {
    conversations,
    loading,
    error,
    startConversation,
    removeConversation,
  } = useConversations();

  const navigate = useNavigate();

  const { pathname } = useLocation();

  const [creating, setCreating] = useState(false);

  /*
   * Existing logic preserved.
   */
  const activeId = pathname.startsWith('/chat/')
    ? pathname.slice('/chat/'.length)
    : undefined;

  /*
   * Existing logic preserved.
   */
  const handleNewChat = async () => {
    setCreating(true);

    try {
      const conversation = await startConversation();

      navigate(`/chat/${conversation.id}`);

      onNavigate?.();
    } catch {
      // startConversation has already put the message
      // in the shared error state.
    } finally {
      setCreating(false);
    }
  };

  /*
   * Existing logic preserved.
   */
  const handleDelete = async (event, id) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      !window.confirm(
        'Delete this chat? This cannot be undone.'
      )
    ) {
      return;
    }

    await removeConversation(id);

    if (activeId === id) {
      navigate('/chat');
    }
  };

  /*
   * Existing logic preserved.
   */
  const handleLogout = async () => {
    await logout();

    navigate('/login', {
      replace: true,
    });
  };

  return (
    <Aside $open={open}>

      {/* ================= BRAND ================= */}

      <Brand>
        <QueryNestLogo />

        <BrandName>
          Query<span>Nest</span>
        </BrandName>
      </Brand>

      {/* ================= NEW CHAT ================= */}

      <NewChatButton
        onClick={handleNewChat}
        disabled={creating}
      >
        {creating ? (
          <Spinner $size={13} />
        ) : (
          <PlusIcon aria-hidden="true">
            +
          </PlusIcon>
        )}

        {creating ? 'Creating...' : 'New chat'}
      </NewChatButton>

      {/* ================= ERROR ================= */}

      {error && (
        <SidebarAlert role="alert">
          {error}
        </SidebarAlert>
      )}

      {/* ================= RECENT CHATS ================= */}

      <RecentHeader>
        <SectionLabel>
          Recent chats
        </SectionLabel>
      </RecentHeader>

      <ChatList>

        {loading && (
          <Empty>
            Loading chats...
          </Empty>
        )}

        {!loading &&
          conversations.length === 0 && (
            <Empty>
              No chats yet
            </Empty>
          )}

        {conversations.map((conversation) => (
          <ChatRow
            key={conversation.id}
            $active={
              conversation.id === activeId
            }
          >

            <ChatIcon
              $active={
                conversation.id === activeId
              }
              aria-hidden="true"
            >
              ✦
            </ChatIcon>

            <ChatLink
              to={`/chat/${conversation.id}`}
              onClick={onNavigate}
              title={conversation.title}
              $active={
                conversation.id === activeId
              }
            >
              {conversation.title}
            </ChatLink>

            <DeleteButton
              onClick={(event) =>
                handleDelete(
                  event,
                  conversation.id
                )
              }
              aria-label={`Delete chat: ${conversation.title}`}
            >
              ×
            </DeleteButton>

          </ChatRow>
        ))}

      </ChatList>

      {/* ================= BOTTOM NAV ================= */}

      <Footer>

        <FooterLink
          to="/dashboard"
          onClick={onNavigate}
        >
          <NavIcon aria-hidden="true">
            ⌂
          </NavIcon>

          Dashboard
        </FooterLink>

        <FooterLink
          to="/documents"
          onClick={onNavigate}
        >
          <NavIcon aria-hidden="true">
            ▣
          </NavIcon>

          Documents
        </FooterLink>

        <FooterLink
          to="/profile"
          onClick={onNavigate}
        >
          <NavIcon aria-hidden="true">
            ♙
          </NavIcon>

          Profile
        </FooterLink>

        <LogoutButton
          onClick={handleLogout}
        >
          <LogoutIcon aria-hidden="true">
            ⇥
          </LogoutIcon>

          Log out
        </LogoutButton>

        {/* ================= USER ================= */}

        <UserStrip>

          <Initial aria-hidden="true">
            {(user?.name || '?')
              .charAt(0)
              .toUpperCase()}
          </Initial>

          <UserMeta>
            <p>{user?.name}</p>
            <span>{user?.email}</span>
          </UserMeta>

          <UserDot />

        </UserStrip>

      </Footer>

    </Aside>
  );
}