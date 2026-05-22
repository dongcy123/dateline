export type EventType = 'todo' | 'note';
export type EventStatus = 'pending' | 'done';

export interface AIMetadata {
  task?: string;
  progress_delta?: number;
  tags?: string[];
  [key: string]: unknown;
}

export interface Objective {
  id: string;
  title: string;
  target: number;
  current: number;
  color: string;
}

export interface TimelineEvent {
  id: string;
  timeline_time: string;
  record_time: string;
  raw_content: string;
  type: EventType;
  status: EventStatus;
  objective_id?: string;
  ai_metadata: AIMetadata;
  created_at?: string;
}
