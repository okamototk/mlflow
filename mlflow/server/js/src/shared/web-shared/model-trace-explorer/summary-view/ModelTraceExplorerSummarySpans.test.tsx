import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { DesignSystemProvider } from '@databricks/design-system';
import { IntlProvider } from '@databricks/i18n';

import { ModelSpanType } from '../ModelTrace.types';
import type { ModelTraceSpanNode } from '../ModelTrace.types';
import { MOCK_OPENAI_CHAT_INPUT, MOCK_OPENAI_CHAT_OUTPUT } from '../ModelTraceExplorer.test-utils';

import { ModelTraceExplorerSummarySpans } from './ModelTraceExplorerSummarySpans';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en">
    <DesignSystemProvider>{children}</DesignSystemProvider>
  </IntlProvider>
);

describe('ModelTraceExplorerSummarySpans', () => {
  it('shows only content for chat-like inputs/outputs', () => {
    const rootNode: ModelTraceSpanNode = {
      key: 'root',
      title: 'root',
      children: [],
      start: 0,
      end: 1,
      type: ModelSpanType.LLM,
      attributes: {},
      events: [],
      assessments: [],
      traceId: 'trace',
      inputs: MOCK_OPENAI_CHAT_INPUT,
      outputs: MOCK_OPENAI_CHAT_OUTPUT,
      chatMessageFormat: 'openai',
    };

    render(<ModelTraceExplorerSummarySpans rootNode={rootNode} intermediateNodes={[]} hideRenderModeSelector />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('tell me a joke in 50 words')).toBeInTheDocument();
    expect(screen.getAllByText('Why did the scarecrow win an award? Because he was outstanding in his field!')[0]).toBeInTheDocument();

    // Should not show the full request/response payload keys in summary.
    expect(screen.queryByText('gpt-4o-mini')).not.toBeInTheDocument();
    expect(screen.queryByText('temperature')).not.toBeInTheDocument();
  });

  it('renders OTEL GenAI messages as separate role messages in summary', () => {
    const otelInputs = [
      {
        role: 'system',
        parts: [{ type: 'text', content: 'System instructions.' }],
      },
      {
        role: 'user',
        parts: [{ type: 'text', content: 'User request text.' }],
      },
    ];

    const otelOutputs = [
      {
        role: 'assistant',
        parts: [{ type: 'text', content: 'Assistant response text.' }],
      },
    ];

    const rootNode: ModelTraceSpanNode = {
      key: 'root',
      title: 'root',
      children: [],
      start: 0,
      end: 1,
      type: ModelSpanType.LLM,
      attributes: {},
      events: [],
      assessments: [],
      traceId: 'trace',
      inputs: otelInputs as any,
      outputs: otelOutputs as any,
      chatMessageFormat: 'openai',
    };

    render(<ModelTraceExplorerSummarySpans rootNode={rootNode} intermediateNodes={[]} hideRenderModeSelector />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('System instructions.')).toBeInTheDocument();

    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('User request text.')).toBeInTheDocument();

    expect(screen.getByText('Assistant')).toBeInTheDocument();
    expect(screen.getByText('Assistant response text.')).toBeInTheDocument();

    // Ensure we don't show raw OTEL JSON keys.
    expect(screen.queryByText('parts')).not.toBeInTheDocument();
  });

  it('renders nested OTEL GenAI messages as separate role messages in summary', () => {
    const otelInputs = [
      {
        role: 'system',
        parts: [{ type: 'text', content: 'System instructions.' }],
      },
      {
        role: 'user',
        parts: [{ type: 'text', content: 'User request text.' }],
      },
    ];

    const rootNode: ModelTraceSpanNode = {
      key: 'root',
      title: 'root',
      children: [],
      start: 0,
      end: 1,
      type: ModelSpanType.LLM,
      attributes: {},
      events: [],
      assessments: [],
      traceId: 'trace',
      inputs: { messages: otelInputs } as any,
      outputs: { messages: [{ role: 'assistant', parts: [{ type: 'text', content: 'Assistant response text.' }] }] } as any,
      chatMessageFormat: 'openai',
    };

    render(<ModelTraceExplorerSummarySpans rootNode={rootNode} intermediateNodes={[]} hideRenderModeSelector />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('System instructions.')).toBeInTheDocument();

    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('User request text.')).toBeInTheDocument();

    // Should not collapse into a single role-labeled plaintext block.
    expect(screen.queryByText('system: System instructions.')).not.toBeInTheDocument();
  });

  it('renders tool calls from OTEL messages in summary', () => {
    const toolCallId = 'call_czZaKCIgreDCSr332ayYt6qk';

    const otelInputs = {
      messages: [
        {
          role: 'assistant',
          parts: [
            {
              type: 'tool_call',
              id: toolCallId,
              name: 'get_random_destination',
              arguments: {},
            },
          ],
        },
        {
          role: 'tool',
          parts: [
            {
              type: 'tool_call_response',
              id: toolCallId,
              response: { type: 'function_result', call_id: toolCallId, result: 'Sydney, Australia' },
            },
          ],
        },
      ],
    };

    const rootNode: ModelTraceSpanNode = {
      key: 'root',
      title: 'root',
      children: [],
      start: 0,
      end: 1,
      type: ModelSpanType.LLM,
      attributes: {},
      events: [],
      assessments: [],
      traceId: 'trace',
      inputs: otelInputs as any,
      outputs: {} as any,
      chatMessageFormat: 'openai',
    };

    render(<ModelTraceExplorerSummarySpans rootNode={rootNode} intermediateNodes={[]} hideRenderModeSelector />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('Assistant')).toBeInTheDocument();
    expect(screen.getByText('get_random_destination')).toBeInTheDocument();
    expect(screen.getAllByText(toolCallId)[0]).toBeInTheDocument();

    // Ensure we don't show raw OTEL JSON keys.
    expect(screen.queryByText('parts')).not.toBeInTheDocument();
  });
});
