import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OmniboxProps {
  onSubmitText: (text: string) => void;
  onCameraPress: () => void;
  onMicPress: () => void;
  isProcessing: boolean;
}

export function Omnibox({ onSubmitText, onCameraPress, onMicPress, isProcessing }: OmniboxProps) {
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();

  const handleSubmit = () => {
    if (text.trim() && !isProcessing) {
      onSubmitText(text.trim());
      setText('');
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.bar}>
        {/* Camera button — triggers vision AI */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onCameraPress}
          disabled={isProcessing}
        >
          <Text style={[styles.icon, isProcessing && styles.iconDisabled]}>📷</Text>
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSubmit}
          placeholder={isProcessing ? 'AI 引擎处理中...' : '输入记录或指令...'}
          placeholderTextColor="#52525b"
          editable={!isProcessing}
          returnKeyType="send"
        />

        {/* Submit or Mic button */}
        {hasText ? (
          <TouchableOpacity
            style={[styles.iconBtn, styles.sendBtn]}
            onPress={handleSubmit}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.icon}>➤</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onMicPress}
            disabled={isProcessing}
          >
            <Text style={[styles.icon, isProcessing && styles.iconDisabled]}>🎤</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(26,26,26,0.98)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingLeft: 4,
    paddingRight: 4,
    paddingVertical: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 16 },
  iconDisabled: { opacity: 0.3 },
  sendBtn: { backgroundColor: 'rgba(255,255,255,0.12)' },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 12,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
});
