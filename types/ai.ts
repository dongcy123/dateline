import type { EventType } from './event';

/** Standardized AI proxy response — both text and vision engines must return this shape */
export interface AIProxyResponse {
  type: EventType;
  ai_metadata: Record<string, unknown>;
  /** Confidence score 0-1, optional */
  confidence?: number;
  /** Raw AI output before normalization, for debug */
  raw_text?: string;
}

/** Request to the AI proxy */
export interface AIProxyRequest {
  /** Text input (voice transcribed to text) */
  text?: string;
  /** Image URL in Supabase Storage */
  image_url?: string;
  /** Engine hint: 'auto' | 'text' | 'vision' */
  engine?: 'auto' | 'text' | 'vision';
}

/** Error from the AI proxy — Stripe-style */
export interface AIProxyError {
  error: {
    type: 'api_error' | 'invalid_request' | 'rate_limit' | 'model_unavailable' | 'parse_error';
    code: string;
    message: string;
    param?: string;
    doc_url?: string;
  };
}
