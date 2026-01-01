import { Button, ChevronDownIcon, ChevronRightIcon, Typography, useDesignSystemTheme } from '@databricks/design-system';
import { isString } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { MlflowService } from '../../sdk/MlflowService';
import Utils from '../../../common/utils/Utils';
import { ErrorWrapper } from '../../../common/utils/ErrorWrapper';
import type { CellContext, ColumnDefTemplate } from '@tanstack/react-table';
import type { ModelTraceInfoWithRunName } from './hooks/useExperimentTraces';
import {
  getTraceInfoInputs,
  getTraceInfoInputsRaw,
  getTraceInfoOutputs,
  getTraceInfoOutputsRaw,
  isTraceMetadataPossiblyTruncated,
} from './TracesView.utils';
import { CodeSnippet } from '@databricks/web-shared/snippet';
import { css } from '@emotion/react';

import { ModelTraceExplorerIcon } from '../../../shared/web-shared/model-trace-explorer/ModelTraceExplorerIcon';
import { ModelIconType } from '../../../shared/web-shared/model-trace-explorer/ModelTrace.types';
import { extractChatMessagesForSummary } from '../../../shared/web-shared/model-trace-explorer/ModelTraceExplorer.utils';

const clampedLinesCss = css`
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
`;

type ChatRole = 'system' | 'user' | 'assistant' | 'tool' | 'function' | 'developer';

type RoleMessage = {
  role: ChatRole;
  content: string;
};

const getRoleIconType = (role: ChatRole) => {
  switch (role) {
    case 'system':
      return ModelIconType.SYSTEM;
    case 'user':
      return ModelIconType.USER;
    case 'assistant':
      return ModelIconType.ASSISTANT;
    case 'tool':
    case 'function':
      return ModelIconType.WRENCH;
    case 'developer':
      return ModelIconType.MODELS;
  }
};

const RoleLabel = ({ role }: { role: ChatRole }) => {
  switch (role) {
    case 'system':
      return (
        <FormattedMessage
          defaultMessage="System"
          description="Label for system role in trace table preview"
        />
      );
    case 'user':
      return (
        <FormattedMessage
          defaultMessage="User"
          description="Label for user role in trace table preview"
        />
      );
    case 'assistant':
      return (
        <FormattedMessage
          defaultMessage="Assistant"
          description="Label for assistant role in trace table preview"
        />
      );
    case 'tool':
      return (
        <FormattedMessage defaultMessage="Tool" description="Label for tool role in trace table preview" />
      );
    case 'function':
      return (
        <FormattedMessage
          defaultMessage="Function"
          description="Label for function role in trace table preview"
        />
      );
    case 'developer':
      return (
        <FormattedMessage
          defaultMessage="Developer"
          description="Label for developer role in trace table preview"
        />
      );
  }
};

const tryExtractRoleMessages = (rawValue?: string | null): RoleMessage[] | null => {
  if (!rawValue) {
    return null;
  }

  const extractedMessages = extractChatMessagesForSummary(rawValue);
  if (!extractedMessages) {
    return null;
  }

  return extractedMessages.map((message) => ({
    role: message.role,
    content: message.content ? String(message.content) : '',
  }));
};

const RoleMessageList = ({ messages, isCompact }: { messages: RoleMessage[]; isCompact: boolean }) => {
  const { theme } = useDesignSystemTheme();

  // Match existing behavior: show the most recent 3 items in compact mode.
  const visibleMessages = isCompact ? messages.slice(-3) : messages;

  return (
    <div css={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
      {visibleMessages.map((message, index) => (
        <div
          key={index}
          css={{
            display: 'flex',
            alignItems: isCompact ? 'center' : 'flex-start',
            gap: theme.spacing.xs,
            minWidth: 0,
          }}
        >
          <ModelTraceExplorerIcon type={getRoleIconType(message.role)} />
          <Typography.Text bold css={{ flexShrink: 0 }}>
            <RoleLabel role={message.role} />:
          </Typography.Text>
          <Typography.Text
            css={{
              minWidth: 0,
              overflow: isCompact ? 'hidden' : undefined,
              textOverflow: isCompact ? 'ellipsis' : undefined,
              whiteSpace: isCompact ? 'nowrap' : 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {message.content}
          </Typography.Text>
        </div>
      ))}
    </div>
  );
};

const TracesViewTablePreviewCell = ({
  value,
  rawValue,
  traceId,
  previewFieldName,
}: {
  value: string;
  rawValue?: string;
  traceId: string;
  previewFieldName: 'request' | 'response';
}) => {
  const { theme } = useDesignSystemTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullData, setFullData] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);

  const fetchFullData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await MlflowService.getExperimentTraceData<{
        request?: any;
        response?: any;
      }>(traceId);

      if (previewFieldName in response) {
        const previewValue = response[previewFieldName];
        const requestData = isString(previewValue) ? previewValue : JSON.stringify(previewValue);
        setFullData(requestData);
      }
    } catch (e: any) {
      const errorMessage = e instanceof ErrorWrapper ? e.getUserVisibleError() : e.message;
      Utils.logErrorAndNotifyUser(`Error fetching response: ${errorMessage}`);
    }
    setLoading(false);
  }, [previewFieldName, traceId]);

  // Use raw metadata length for truncation detection.
  const valuePossiblyTruncated = isTraceMetadataPossiblyTruncated(rawValue ?? value);

  const expand = useCallback(async () => {
    if (!fullData && valuePossiblyTruncated) {
      await fetchFullData();
    }
    setIsExpanded(true);
  }, [fullData, fetchFullData, valuePossiblyTruncated]);

  const collapse = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const collapsedRoleMessages = useMemo(() => tryExtractRoleMessages(rawValue), [rawValue]);
  const expandedRoleMessages = useMemo(
    () => tryExtractRoleMessages(fullData ?? rawValue),
    [fullData, rawValue],
  );

  const content = isExpanded ? fullData ?? value : value;

  return (
    <div css={{ display: 'flex', gap: theme.spacing.xs }}>
      <Button
        // it's difficult to distinguish between run and experiment page
        // in this component due to how the data is passed to the table,
        // so the base component ID here is simply `mlflow.traces`
        componentId="mlflow.traces.traces_table.expand_cell_preview"
        size="small"
        icon={isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        onClick={isExpanded ? collapse : expand}
        css={{ flexShrink: 0 }}
        loading={loading}
        type="primary"
      />
      <div
        title={value}
        css={[
          {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
          // When rendering per-message rows, truncation is handled by limiting rows.
          !isExpanded && !collapsedRoleMessages && clampedLinesCss,
        ]}
      >
        {isExpanded ? (
          expandedRoleMessages ? (
            <RoleMessageList messages={expandedRoleMessages} isCompact={false} />
          ) : (
            <ExpandedParamCell value={content} />
          )
        ) : collapsedRoleMessages ? (
          <RoleMessageList messages={collapsedRoleMessages} isCompact />
        ) : (
          content
        )}
      </div>
    </div>
  );
};

const ExpandedParamCell = ({ value }: { value: string }) => {
  const { theme } = useDesignSystemTheme();

  const structuredJSONValue = useMemo(() => {
    // Attempts to parse the value as JSON and returns a pretty printed version if successful.
    // If JSON structure is not found, returns null.
    try {
      const objectData = JSON.parse(value);
      return JSON.stringify(objectData, null, 2);
    } catch (e) {
      return null;
    }
  }, [value]);
  return (
    <div
      css={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: structuredJSONValue ? 'monospace' : undefined,
      }}
    >
      <CodeSnippet
        language="json"
        wrapLongLines
        style={{
          padding: theme.spacing.sm,
        }}
        theme={theme.isDarkMode ? 'duotoneDark' : 'light'}
      >
        {structuredJSONValue || value}
      </CodeSnippet>
    </div>
  );
};

export const TracesViewTableRequestPreviewCell: ColumnDefTemplate<CellContext<ModelTraceInfoWithRunName, unknown>> = ({
  row: { original },
}) => (
  <TracesViewTablePreviewCell
    previewFieldName="request"
    traceId={original.request_id || ''}
    value={getTraceInfoInputs(original) || ''}
    rawValue={getTraceInfoInputsRaw(original) || ''}
  />
);

export const TracesViewTableResponsePreviewCell: ColumnDefTemplate<CellContext<ModelTraceInfoWithRunName, unknown>> = ({
  row: { original },
}) => (
  <TracesViewTablePreviewCell
    previewFieldName="response"
    traceId={original.request_id || ''}
    value={getTraceInfoOutputs(original) || ''}
    rawValue={getTraceInfoOutputsRaw(original) || ''}
  />
);
