import type { EventType } from './event';

export interface AIProxyRequest {
  text: string;
  engine: 'text' | 'vision';
}

export interface AIProxyResponse {
  type: EventType | 'objective';
  objective_id: string | null;
  is_key_node?: boolean;
  ai_metadata?: {
    task_title?: string;
    progress_delta?: number;
    color?: string;
    tags?: string[];
    [key: string]: unknown;
  };
  timeline_time?: string;  // ISO 8601 or null
  error?: {
    type: string;
    code: string;
    message: string;
  };
}
