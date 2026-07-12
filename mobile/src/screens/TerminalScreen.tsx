import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function TerminalScreen() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [currentHost, setCurrentHost] = useState<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const queryClient = useQueryClient();

  const connectMutation = useMutation({
    mutationFn: api.connectSSH,
    onSuccess: (data) => {
      setConnected(true);
      setCurrentHost(data.host);
      setOutput((prev) => [...prev, `Connected to ${data.host.name}`]);
    },
  });

  const executeMutation = useMutation({
    mutationFn: ({ command, sessionId }: { command: string; sessionId: string }) =>
      api.executeCommand(sessionId, command),
    onSuccess: (data) => {
      setOutput((prev) => [...prev, `$ ${data.command}`, data.output]);
      scrollViewRef.current?.scrollToEnd({ animated: true });
    },
  });

  const handleSend = () => {
    if (!input.trim() || !connected) return;

    executeMutation.mutate({
      command: input,
      sessionId: currentHost?.id || '',
    });

    setInput('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>
          {currentHost ? currentHost.name : 'Terminal'}
        </Text>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: connected ? '#22c55e' : '#ef4444' },
          ]}
        />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.outputContainer}
        contentContainerStyle={styles.outputContent}
      >
        {output.map((line, index) => (
          <Text key={index} style={styles.outputLine}>
            {line}
          </Text>
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Enter command..."
          placeholderTextColor="#64748b"
          onSubmitEditing={handleSend}
          editable={connected}
        />
        <TouchableOpacity
          style={[styles.sendButton, !connected && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!connected}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  outputContainer: {
    flex: 1,
    padding: 16,
  },
  outputContent: {
    gap: 4,
  },
  outputLine: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#22c55e',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#ffffff',
  },
  sendButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#334155',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
