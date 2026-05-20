export type EventType = 'expense' | 'todo' | 'note';
export type EventStatus = 'pending' | 'confirmed' | 'done';
export type Priority = 'high' | 'normal' | 'low';

export interface ExpenseMeta {
  amount: number;
  tag: string;
  merchant?: string;
}

export interface TodoMeta {
  task: string;
  priority: Priority;
  due_date?: string;
}

export interface NoteMeta {
  summary?: string;
  tags?: string[];
}

export type AIMetadata = ExpenseMeta | TodoMeta | NoteMeta | Record<string, never>;

export interface TimelineEvent {
  id: string;
  timeline_time: string;
  record_time: string;
  raw_content: string;
  type: EventType;
  status: EventStatus;
  ai_metadata: AIMetadata;
  created_at?: string;
}
