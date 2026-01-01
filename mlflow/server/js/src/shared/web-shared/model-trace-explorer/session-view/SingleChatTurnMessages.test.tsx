import { render, screen } from '@testing-library/react';

import { DesignSystemProvider } from '@databricks/design-system';
import { IntlProvider } from '@databricks/i18n';

import type { ModelTrace, ModelTraceSpanV2 } from '../ModelTrace.types';
import { ModelSpanType } from '../ModelTrace.types';

import { SingleChatTurnMessages } from './SingleChatTurnMessages';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en">
    <DesignSystemProvider>{children}</DesignSystemProvider>
  </IntlProvider>
);

describe('SingleChatTurnMessages', () => {
  it('renders chat-like outputs as role messages (not raw JSON)', () => {
    const span: ModelTraceSpanV2 = {
      name: 'root',
      context: { span_id: 'span', trace_id: 'trace' },
      parent_id: null,
      start_time: 0,
      end_time: 1,
      span_type: 'TEST',
      status: { description: 'OK', status_code: 1 },
      events: [],
      attributes: {
        'mlflow.spanType': JSON.stringify(ModelSpanType.LLM),
        // Intentionally nest the chat payload to simulate cases where chatMessages
        // extraction fails, forcing the Summary Inputs/Outputs renderer.
        'mlflow.spanInputs': JSON.stringify({ request: { messages: [{ role: 'user', content: 'Hi' }] } }),
        'mlflow.spanOutputs': JSON.stringify({
          response: {
            choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
          },
        }),
      },
    };

    const trace: ModelTrace = {
      info: { request_id: 'trace' },
      data: { spans: [span] },
    };

    render(<SingleChatTurnMessages trace={trace} />, { wrapper: Wrapper });

    expect(screen.getByText('Outputs')).toBeInTheDocument();
    expect(screen.getByText('Assistant')).toBeInTheDocument();
    expect(screen.getByText('Hello!')).toBeInTheDocument();

    // Ensure we render messages rather than raw response payload keys.
    expect(screen.queryByText('choices')).not.toBeInTheDocument();
  });
});
