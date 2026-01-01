import { getTraceInfoInputs, getTraceInfoOutputs } from './TracesView.utils';

describe('TracesView.utils', () => {
  describe('getTraceInfoInputs / getTraceInfoOutputs', () => {
    it('extracts only text from OTEL gen_ai.*.messages payloads', () => {
      const otelInputs = [
        {
          role: 'system',
          parts: [{ type: 'text', content: 'You are helpful.' }],
        },
        {
          role: 'user',
          parts: [{ type: 'text', content: 'Plan a trip to Okayama.' }],
        },
      ];
      const otelOutputs = [
        {
          role: 'assistant',
          parts: [
            { type: 'tool_call', id: 'c1', name: 'get_random_destination', arguments: {} },
            { type: 'text', content: 'Here is a plan.' },
          ],
        },
      ];

      const traceInfo: any = {
        request_metadata: [
          { key: 'mlflow.traceInputs', value: JSON.stringify(otelInputs) },
          { key: 'mlflow.traceOutputs', value: JSON.stringify(otelOutputs) },
        ],
      };

      expect(getTraceInfoInputs(traceInfo)).toBe('You are helpful.\nPlan a trip to Okayama.');
      expect(getTraceInfoOutputs(traceInfo)).toBe('Here is a plan.');
    });

    it('falls back to unescaped JSON for non-OTEL JSON', () => {
      const traceInfo: any = {
        request_metadata: [
          { key: 'mlflow.traceInputs', value: JSON.stringify({ foo: 'バー' }) },
          { key: 'mlflow.traceOutputs', value: JSON.stringify({ ok: true }) },
        ],
      };

      expect(getTraceInfoInputs(traceInfo)).toBe('{"foo":"バー"}');
      expect(getTraceInfoOutputs(traceInfo)).toBe('{"ok":true}');
    });

    it('returns raw string when metadata is not JSON', () => {
      const traceInfo: any = {
        request_metadata: [
          { key: 'mlflow.traceInputs', value: 'raw input' },
          { key: 'mlflow.traceOutputs', value: 'raw output' },
        ],
      };

      expect(getTraceInfoInputs(traceInfo)).toBe('raw input');
      expect(getTraceInfoOutputs(traceInfo)).toBe('raw output');
    });

    it('returns undefined when fields are missing', () => {
      const traceInfo: any = { request_metadata: [] };
      expect(getTraceInfoInputs(traceInfo)).toBeUndefined();
      expect(getTraceInfoOutputs(traceInfo)).toBeUndefined();
    });
  });
});
