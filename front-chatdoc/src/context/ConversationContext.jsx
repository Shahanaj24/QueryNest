/**
 * Shared conversation list state.
 *
 * The sidebar and the chat pages both need the same list, and both mutate it
 * (new chat, first-message auto-title, delete). Holding it in one provider
 * keeps them in sync without prop drilling or refetching on every navigation.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { conversationApi, errorMessage } from '../api/client';
import { useAuth } from './AuthContext';

const ConversationContext = createContext(null);

export function ConversationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await conversationApi.list();
      setConversations(data.conversations);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your chats.'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Load on login; clear on logout so one user's titles never linger on screen
  // for the next (requirement 3).
  useEffect(() => {
    refresh();
  }, [refresh]);

  const startConversation = useCallback(async () => {
    try {
      const { conversation } = await conversationApi.create();
      setConversations((current) => [conversation, ...current]);
      setError('');
      return conversation;
    } catch (err) {
      // Surface it in the shared error state so the sidebar can show it, and
      // re-throw so the caller does not navigate to a chat that was not made.
      setError(errorMessage(err, 'Could not start a new chat.'));
      throw err;
    }
  }, []);

  const removeConversation = useCallback(async (id) => {
    // Optimistic: the row disappears immediately, and is restored if the
    // request fails so the UI never lies about what is stored.
    const previous = conversations;
    setConversations((current) => current.filter((item) => item.id !== id));
    try {
      await conversationApi.remove(id);
    } catch (err) {
      setConversations(previous);
      setError(errorMessage(err, 'Could not delete that chat.'));
    }
  }, [conversations]);

  /**
   * Called after a reply arrives. The backend auto-titles the conversation from
   * the first question, so merging the returned object is what makes the
   * placeholder title in the sidebar become the real one.
   */
  const applyConversationUpdate = useCallback((updated) => {
    setConversations((current) => {
      const existing = current.find((item) => item.id === updated.id);
      if (!existing) return current;
      const rest = current.filter((item) => item.id !== updated.id);
      return [{ ...existing, ...updated }, ...rest];
    });
  }, []);

  const value = useMemo(
    () => ({
      conversations,
      loading,
      error,
      refresh,
      startConversation,
      removeConversation,
      applyConversationUpdate,
    }),
    [conversations, loading, error, refresh, startConversation, removeConversation, applyConversationUpdate],
  );

  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export function useConversations() {
  const context = useContext(ConversationContext);
  if (!context) throw new Error('useConversations must be used inside ConversationProvider');
  return context;
}
