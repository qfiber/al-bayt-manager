import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type SSEHandler = (event: string, data: any) => void;

export function useSSE(onEvent?: SSEHandler) {
  const { user } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef<Set<SSEHandler>>(new Set());

  if (onEvent) handlersRef.current.add(onEvent);

  useEffect(() => {
    if (!user) return;

    // Don't create multiple connections
    if (eventSourceRef.current) return;

    const es = new EventSource('/api/sse/stream', { withCredentials: true });
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      console.log('SSE connected');
    });

    // Listen for all audit events
    const eventTypes = [
      'create', 'update', 'delete', 'login', 'signup',
    ];

    const tables = ['payments', 'apartments', 'expenses', 'issue_reports'];

    for (const type of eventTypes) {
      for (const table of tables) {
        es.addEventListener(`${type}.${table}`, (e) => {
          const data = JSON.parse(e.data);
          for (const handler of handlersRef.current) handler(`${type}.${table}`, data);
        });
      }
    }

    // Generic message handler for any event
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        for (const handler of handlersRef.current) handler('message', data);
      } catch {}
    };

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [user]);

  const subscribe = useCallback((handler: SSEHandler) => {
    handlersRef.current.add(handler);
    return () => { handlersRef.current.delete(handler); };
  }, []);

  return { subscribe };
}
