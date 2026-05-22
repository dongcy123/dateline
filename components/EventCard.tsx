import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import type { TimelineEvent } from '@/types/event';

interface EventCardProps {
  event: TimelineEvent;
  onConfirm: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TimelineEvent>) => void;
  onDelete: (id: string) => void;
}

const TYPE_LABELS: Record<string, string> = { todo: '待办', note: '笔记' };
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  todo: { bg: 'rgba(139,127,184,0.12)', text: '#8B7FB8', border: 'rgba(139,127,184,0.20)' },
  note: { bg: 'rgba(139,127,184,0.08)', text: '#8B84A0', border: 'rgba(139,127,184,0.12)' },
};
const PENDING_COLORS = { bg: 'rgba(139,127,184,0.12)', text: '#8B7FB8', border: 'rgba(139,127,184,0.30)' };

export function EventCard({ event, onConfirm, onUpdate, onDelete }: EventCardProps) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(event);
  const isPending = event.status === 'pending';
  const date = new Date(event.timeline_time);
  const colors = isPending ? PENDING_COLORS : (TYPE_COLORS[event.type] || TYPE_COLORS.note);

  const formatTime = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const formatDate = (d: Date) =>
    `${d.getMonth() + 1}月${d.getDate()}日`;

  const metadataEntries = Object.entries(event.ai_metadata || {});

  if (editing) {
    return (
      <View style={styles.row}>
        <View style={styles.timeline}>
          <Text style={styles.timeText}>{formatTime(date)}</Text>
          <View style={[styles.dot, { backgroundColor: '#71717a' }]} />
          <View style={styles.line} />
        </View>

        <View style={[styles.card, styles.cardEditing]}>
          <View style={styles.editHeader}>
            <Text style={styles.editTitle}>编辑模式</Text>
            <TouchableOpacity onPress={() => onDelete(event.id)} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>删除</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.editInput}
            value={editData.raw_content}
            onChangeText={(t) => setEditData({ ...editData, raw_content: t })}
            placeholder="记录内容..."
            placeholderTextColor="#52525b"
            multiline
          />

          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => { onUpdate(event.id, editData); setEditing(false); }}
            >
              <Text style={styles.saveText}>保存修改</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setEditData(event); setEditing(false); }}
            >
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.row} onPress={() => setEditing(true)} activeOpacity={0.7}>
      <View style={styles.timeline}>
        <Text style={styles.timeText}>{formatTime(date)}</Text>
        <View style={[styles.dot, isPending && styles.dotPending, { backgroundColor: isPending ? '#3b82f6' : '#3f3f46' }]} />
        <View style={styles.line} />
      </View>

      <View style={[styles.card, isPending && styles.cardPending]}>
        {/* Type badge */}
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>
              {TYPE_LABELS[event.type] || event.type}
            </Text>
          </View>
          <Text style={styles.dateText}>{formatDate(date)}</Text>
        </View>

        {/* Content */}
        <Text style={styles.content}>{event.raw_content}</Text>

        {/* AI metadata */}
        {metadataEntries.length > 0 && (
          <View style={styles.metadataBox}>
            <Text style={styles.metaLabel}>AI 结构化数据</Text>
            <View style={styles.metaTags}>
              {metadataEntries.map(([key, val]) => (
                <View key={key} style={styles.metaTag}>
                  <Text style={styles.metaTagText}>
                    {key}: {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Confirm button for pending */}
        {isPending && (
          <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(event.id)}>
            <Text style={styles.confirmText}>✓ 确认入库</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', width: '100%' },
  timeline: { width: 48, alignItems: 'center' },
  timeText: { fontSize: 11, color: '#8B84A0', marginBottom: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#F5F0EB', zIndex: 10 },
  dotPending: { shadowColor: '#8B7FB8', shadowOpacity: 0.5, shadowRadius: 6 },
  line: { width: 1, flex: 1, backgroundColor: 'rgba(184,181,224,0.2)', marginTop: -1 },
  card: {
    flex: 1,
    marginLeft: 12,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.40)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.30)',
    shadowColor: '#8B7FB8',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  cardPending: {
    backgroundColor: 'rgba(255,255,255,0.50)',
    borderColor: 'rgba(139,127,184,0.30)',
    shadowColor: '#8B7FB8',
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  cardEditing: {
    borderColor: '#B8B5E0',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  dateText: { fontSize: 10, color: '#8B84A0' },
  content: { fontSize: 14, color: '#2D2838', marginBottom: 12, lineHeight: 20 },
  metadataBox: { backgroundColor: 'rgba(232,228,244,0.3)', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 0.5, borderColor: 'rgba(184,181,224,0.2)' },
  metaLabel: { fontSize: 10, color: '#8B84A0', marginBottom: 4 },
  metaTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaTag: { backgroundColor: 'rgba(232,228,244,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  metaTagText: { fontSize: 11, color: '#5C5670' },
  confirmBtn: { backgroundColor: '#B8B5E0', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  confirmText: { color: '#F5F0EB', fontSize: 14, fontWeight: '500' },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  editTitle: { color: '#2D2838', fontSize: 13 },
  deleteBtn: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  deleteText: { color: '#f87171', fontSize: 12 },
  editInput: { backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 0.5, borderColor: 'rgba(184,181,224,0.2)', borderRadius: 12, padding: 12, color: '#2D2838', fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 12 },
  editActions: { flexDirection: 'row', gap: 8 },
  saveBtn: { flex: 1, backgroundColor: '#B8B5E0', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  saveText: { color: '#F5F0EB', fontSize: 13, fontWeight: '500' },
  cancelBtn: { flex: 1, backgroundColor: 'rgba(232,228,244,0.5)', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: '#8B84A0', fontSize: 13 },
});
