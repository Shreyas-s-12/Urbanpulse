import { useState, useCallback } from 'react';
import { CopilotMessage, ResolvedLocation, UnifiedCityEvent } from '@shared/types';
import { copilotService } from '@/services/copilotService';

export function useCopilot() {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (
      query: string,
      location: ResolvedLocation,
      events: UnifiedCityEvent[],
      radiusKm: number,
      weatherSummary?: string
    ) => {
      const userMsg: CopilotMessage = {
        id: 'USER-' + Date.now(),
        sender: 'user',
        content: query,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      try {
        const reply = await copilotService.queryCopilot(
          query,
          location,
          events,
          radiusKm,
          weatherSummary
        );
        setMessages((prev) => [...prev, reply]);
        return reply;
      } catch (err: any) {
        setError(err?.message || 'Copilot failed to generate a response');
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { messages, setMessages, sendMessage, loading, error };
}
