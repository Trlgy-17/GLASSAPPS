import Anthropic from '@anthropic-ai/sdk';
import { ScreenshotInput, ExtractionOutput, DraftReplyOutput, FastRevisionParams } from './provider';
import { PriceBookData } from '@/types/pricing';

let _anthropicClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY tidak ditemukan di environment');
    }
    _anthropicClient = new Anthropic({ apiKey });
  }
  return _anthropicClient;
}

export interface ClaudeInactiveState {
  active: boolean;
  reason: 'saldo' | 'key_invalid' | null;
  message: string | null;
}

let _claudeInactiveState: ClaudeInactiveState = {
  active: true,
  reason: null,
  message: null,
};

export function getClaudeInactiveState(): ClaudeInactiveState {
  return _claudeInactiveState;
}

export function setClaudeInactive(reason: 'saldo' | 'key_invalid', message: string): void {
  _claudeInactiveState = {
    active: false,
    reason,
    message,
  };
}

export function resetClaudeInactive(): void {
  _claudeInactiveState = {
    active: true,
    reason: null,
    message: null,
  };
}

/**
 * Format nama display model untuk panel draf UI
 */
export function formatModelDisplayName(modelName?: string | null): string {
  if (!modelName) return 'Gemini 3.6 Flash';
  const lower = modelName.toLowerCase();
  if (lower.includes('claude') || lower.includes('haiku')) {
    if (lower.includes('5-5') || lower.includes('5.5')) return 'Claude Haiku 5.5';
    if (lower.includes('4-5') || lower.includes('4.5')) return 'Claude Haiku 4.5';
    return 'Claude Haiku';
  }
  if (lower.includes('3.8')) return 'Gemini 3.8 Flash';
  if (lower.includes('3.6')) return 'Gemini 3.6 Flash';
  if (lower.includes('3.5') || lower.includes('lite')) return 'Gemini 3.5 Flash Lite';
  return modelName;
}

/**
 * Panggil Claude Messages API dengan streaming untuk mendapatkan TTFT & akumulasi teks
 */
export async function callClaudeMessagesStream(params: {
  model: string;
  systemPrompt: string;
  messages: Array<Anthropic.MessageParam>;
  maxTokens?: number;
  abortSignal?: AbortSignal;
  onChunk?: (text: string) => void;
}): Promise<{
  text: string;
  ttftMs: number;
  totalMs: number;
  inputTokens: number;
  outputTokens: number;
}> {
  const client = getAnthropicClient();
  const t0 = Date.now();
  let ttftMs = 0;
  let gotFirst = false;
  let accumulated = '';
  let inputTokens = 0;
  let outputTokens = 0;

  // Siapkan parameter thinking: { type: 'disabled' } sesuai docs Claude Haiku 5.5
  const baseParams: Anthropic.MessageCreateParams = {
    model: params.model,
    max_tokens: params.maxTokens || 1200,
    system: params.systemPrompt,
    messages: params.messages,
    stream: true,
  };

  try {
    const stream = await client.messages.create(
      {
        ...baseParams,
        thinking: { type: 'disabled' } as any,
      },
      { signal: params.abortSignal }
    );

    for await (const chunk of stream) {
      if (params.abortSignal?.aborted) {
        throw new Error('Permintaan dibatalkan oleh sinyal abort');
      }

      if (chunk.type === 'message_start' && chunk.message?.usage) {
        inputTokens = chunk.message.usage.input_tokens || 0;
      }

      if (chunk.type === 'content_block_delta') {
        if (!gotFirst) {
          gotFirst = true;
          ttftMs = Date.now() - t0;
        }
        if (chunk.delta.type === 'text_delta') {
          accumulated += chunk.delta.text;
          params.onChunk?.(chunk.delta.text);
        }
      }

      if (chunk.type === 'message_delta' && chunk.usage) {
        outputTokens = chunk.usage.output_tokens || 0;
      }
    }
  } catch (err: any) {
    // Tangani jika model menolak parameter thinking: { type: 'disabled' } -> coba tanpa parameter thinking
    if (err.status === 400 && String(err.message).includes('thinking')) {
      const streamRetry = await client.messages.create(baseParams, { signal: params.abortSignal });
      for await (const chunk of streamRetry) {
        if (params.abortSignal?.aborted) {
          throw new Error('Permintaan dibatalkan oleh sinyal abort');
        }
        if (chunk.type === 'message_start' && chunk.message?.usage) {
          inputTokens = chunk.message.usage.input_tokens || 0;
        }
        if (chunk.type === 'content_block_delta') {
          if (!gotFirst) {
            gotFirst = true;
            ttftMs = Date.now() - t0;
          }
          if (chunk.delta.type === 'text_delta') {
            accumulated += chunk.delta.text;
            params.onChunk?.(chunk.delta.text);
          }
        }
        if (chunk.type === 'message_delta' && chunk.usage) {
          outputTokens = chunk.usage.output_tokens || 0;
        }
      }
    } else {
      throw err;
    }
  }

  const totalMs = Date.now() - t0;
  if (!ttftMs) ttftMs = totalMs;

  return {
    text: accumulated,
    ttftMs,
    totalMs,
    inputTokens,
    outputTokens,
  };
}
