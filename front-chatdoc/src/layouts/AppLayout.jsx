/**
 * Shell for all authenticated pages: fixed sidebar, scrollable main column,
 * and a mobile drawer toggle.
 */

import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import Sidebar from '../components/Sidebar';
import { ConversationProvider } from '../context/ConversationContext';
import { theme } from '../theme';

const Shell = styled.div`
  display: flex;
  height: 100vh;
  overflow: hidden;
`;

const Main = styled.main`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: ${theme.color.canvas};
`;

const TopBar = styled.div`
  display: none;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid ${theme.color.line};
  background: ${theme.color.paper};

  @media (max-width: 860px) { display: flex; }
`;

const MenuButton = styled.button`
  border: 1px solid ${theme.color.line};
  background: ${theme.color.paper};
  border-radius: ${theme.radius.md};
  padding: 6px 10px;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
`;

const Scrim = styled.div`
  display: none;

  @media (max-width: 860px) {
    display: ${({ $show }) => ($show ? 'block' : 'none')};
    position: fixed;
    inset: 0;
    z-index: 25;
    background: rgba(22, 24, 29, 0.32);
  }
`;

const TopBarTitle = styled.strong`
  font-size: 14px;
`;

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <ConversationProvider>
      <Shell>
        <Sidebar open={drawerOpen} onNavigate={() => setDrawerOpen(false)} />
        <Scrim $show={drawerOpen} onClick={() => setDrawerOpen(false)} />

        <Main>
          <TopBar>
            <MenuButton onClick={() => setDrawerOpen((open) => !open)} aria-label="Toggle menu">
              ☰
            </MenuButton>
            <TopBarTitle>Chat with Your Documents</TopBarTitle>
          </TopBar>

          <Outlet />
        </Main>
      </Shell>
    </ConversationProvider>
  );
}
