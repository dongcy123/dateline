import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Platform } from 'react-native';
import type { TimelineEvent } from '@/types/event';
import { useEventStore } from '@/hooks/useEvents';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

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
  const objectives = useEventStore((s) => s.objectives);
  const linkedObj = event.objective_id ? objectives.find((o) => o.id === event.objective_id) : undefined;

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

          <Text style={styles.timeLabel}>时间</Text>
          <TextInput
            style={styles.editInputSmall}
            value={(() => { const d = new Date(editData.timeline_time); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
            onChangeText={(t) => {
              try { const d = new Date(t); if (!isNaN(d.getTime())) setEditData({ ...editData, timeline_time: d.toISOString() }); } catch {}
            }}
            placeholder="YYYY-MM-DDTHH:MM"
            placeholderTextColor="#52525b"
          />

          <View style={styles.statusRow}>
            <TouchableOpacity
              style={[styles.checkbox, editData.status === 'done' && styles.checkboxChecked]}
              onPress={() => setEditData({ ...editData, status: editData.status === 'done' ? 'pending' : 'done' })}
            >
              {editData.status === 'done' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.statusLabel}>已完成</Text>
          </View>

          {/* 关键节点 */}
          <View style={{ marginBottom: 12 }}>
            <View style={styles.statusRow}>
              <TouchableOpacity
                style={[styles.checkbox, editData.is_key_node && styles.checkboxChecked, !editData.objective_id && { opacity: 0.35 }]}
                onPress={() => {
                  if (!editData.objective_id) return;
                  const newKn = !editData.is_key_node;
                  setEditData({
                    ...editData,
                    is_key_node: newKn,
                    ai_metadata: { ...editData.ai_metadata, progress_delta: newKn ? (editData.ai_metadata?.progress_delta || 1) : 0 }
                  });
                }}
                disabled={!editData.objective_id}
              >
                {editData.is_key_node && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              <Text style={[styles.statusLabel, editData.is_key_node && { color: '#8B7FB8', fontWeight: '600' }]}>关键节点</Text>
              {editData.is_key_node && <Text style={{ fontSize: 10, color: '#8B84A0' }}>贡献目标进度</Text>}
              {!editData.objective_id && <Text style={{ fontSize: 10, color: '#8B84A0', opacity: 0.6 }}>请先关联目标</Text>}
            </View>
            {editData.is_key_node && editData.objective_id && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.timeLabel}>贡献值 (progress_delta)</Text>
                <TextInput
                  style={styles.editInputSmall}
                  value={String(editData.ai_metadata?.progress_delta || 0)}
                  onChangeText={(t) => setEditData({ ...editData, ai_metadata: { ...editData.ai_metadata, progress_delta: parseInt(t) || 0 } })}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#52525b"
                />
              </View>
            )}
          </View>

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
        <View style={[styles.dot, isPending ? styles.dotPending : styles.dotDone]} />
        <View style={styles.line} />
      </View>

      <View style={[styles.card, isPending && styles.cardPending]}>
        {linkedObj && (
          <View style={[styles.objStrip, { backgroundColor: linkedObj.color }]} />
        )}
        {/* Type badge + key node */}
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <Text style={[styles.badgeText, { color: colors.text }]}>
                {TYPE_LABELS[event.type] || event.type}
              </Text>
            </View>
            {event.is_key_node && (
              <View style={[styles.badge, { backgroundColor: 'rgba(139,127,184,0.12)', borderColor: 'rgba(139,127,184,0.25)' }]}>
                <Text style={[styles.badgeText, { color: '#8B7FB8' }]}>关键节点</Text>
              </View>
            )}
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
  timeText: { fontSize: 10, color: '#8B84A0', marginBottom: 4, fontFamily: MONO },
  dot: { width: 6, height: 6, borderRadius: 3, zIndex: 10 },
  dotDone: { backgroundColor: '#3f3f46' },
  dotPending: { backgroundColor: '#8B7FB8' },
  line: { width: 1, flex: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginTop: -1 },
  card: {
    flex: 1,
    marginLeft: 12,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  cardPending: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0,0,0,0.10)',
    borderWidth: 1,
  },
  objStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
  },
  cardEditing: {
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#FFFFFF',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  dateText: { fontSize: 10, color: '#8B84A0', fontFamily: MONO },
  content: { fontSize: 14, color: '#2D2838', marginBottom: 12, lineHeight: 20 },
  metadataBox: { backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  metaLabel: { fontSize: 10, color: '#8B84A0', marginBottom: 4, fontFamily: MONO },
  metaTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaTag: { backgroundColor: 'rgba(232,228,244,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  metaTagText: { fontSize: 11, color: '#5C5670' },
  confirmBtn: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  confirmText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', fontFamily: MONO },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  editTitle: { color: '#2D2838', fontSize: 13 },
  deleteBtn: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  deleteText: { color: '#f87171', fontSize: 12 },
  editInput: { backgroundColor: 'rgba(0,0,0,0.02)', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 10, padding: 12, color: '#1a1a1a', fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 12 },
  timeLabel: { fontSize: 10, color: '#8B84A0', marginBottom: 4, fontFamily: MONO },
  editInputSmall: { backgroundColor: 'rgba(0,0,0,0.02)', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 10, padding: 10, color: '#1a1a1a', fontSize: 13, marginBottom: 12, fontFamily: MONO },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(184,181,224,0.4)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.25)' },
  checkboxChecked: { backgroundColor: '#B8B5E0', borderColor: '#8B7FB8' },
  checkmark: { color: '#F5F0EB', fontSize: 14, fontWeight: '700' },
  statusLabel: { fontSize: 13, color: '#5C5670' },
  editActions: { flexDirection: 'row', gap: 8 },
  saveBtn: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', fontFamily: MONO },
  cancelBtn: { flex: 1, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: '#8B84A0', fontSize: 13 },
});
