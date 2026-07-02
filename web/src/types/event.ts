export type EventType = 'todo' | 'note';
export type EventStatus = 'pending' | 'done';

export interface AIMetadata {
  task_title?: string;
  progress_delta?: number;
  tags?: string[];
  color?: string;
  [key: string]: unknown;
}

export interface TimelineEvent {
  id: string;
  timeline_time: string;   // ISO 8601
  record_time: string;     // ISO 8601
  raw_content: string;
  type: EventType;
  status: EventStatus;
  objective_id?: string;
  is_key_node?: boolean;
  ai_metadata: AIMetadata;
}

export interface Objective {
  id: string;
  title: string;
  target: number;
  current: number;
  color: string;
}
