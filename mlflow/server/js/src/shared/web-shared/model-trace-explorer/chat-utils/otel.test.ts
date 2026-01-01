import { describe, expect, it } from '@jest/globals';

import { normalizeConversation } from '../ModelTraceExplorer.utils';
import { extractTextFromOtelGenAIMessages } from './otel';

describe('normalizeConversation (OTEL GenAI)', () => {
  it('normalizes simple text messages', () => {
    const input = [
      {
        role: 'user',
        parts: [{ type: 'text', content: 'Hello there' }],
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', content: 'Hi! How can I help?' }],
      },
    ];

    const result = normalizeConversation(input);

    expect(result).toEqual([
      expect.objectContaining({ role: 'user', content: 'Hello there' }),
      expect.objectContaining({ role: 'assistant', content: 'Hi! How can I help?' }),
    ]);
  });

  it('normalizes tool call request and response', () => {
    const input = [
      {
        role: 'assistant',
        parts: [
          { type: 'text', content: 'Let me check the weather.' },
          { type: 'tool_call', id: 'call_weather_1', name: 'get_weather', arguments: { city: 'NYC' } },
        ],
      },
      {
        role: 'assistant',
        parts: [{ type: 'tool_call_response', id: 'call_weather_1', response: { tempC: 22 } }],
      },
    ];

    const result = normalizeConversation(input);
    expect(result).toHaveLength(2);

    // First message: assistant with a tool_call
    expect(result?.[0]).toEqual(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('Let me check the weather.'),
        tool_calls: [
          expect.objectContaining({
            id: 'call_weather_1',
            function: expect.objectContaining({ name: 'get_weather', arguments: expect.any(String) }),
          }),
        ],
      }),
    );

    // Second message: tool response mapped to role 'tool'
    expect(result?.[1]).toEqual(
      expect.objectContaining({
        role: 'tool',
        tool_call_id: 'call_weather_1',
        content: expect.stringContaining('tempC'),
      }),
    );
  });
});

describe('extractTextFromOtelGenAIMessages', () => {
  it('extracts only text parts', () => {
    const input = [
      {
        role: 'assistant',
        parts: [
          { type: 'text', content: 'Let me check.' },
          { type: 'tool_call', id: 'c1', name: 'get_weather', arguments: { city: 'NYC' } },
        ],
      },
      {
        role: 'assistant',
        parts: [{ type: 'tool_call_response', id: 'c1', response: { tempC: 22 } }],
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', content: 'It is 22C.' }],
      },
    ];

    expect(extractTextFromOtelGenAIMessages(input)).toBe('Let me check.\nIt is 22C.');
  });

  it('returns null for non-OTEL messages', () => {
    expect(extractTextFromOtelGenAIMessages({ messages: [] })).toBeNull();
  });
});
