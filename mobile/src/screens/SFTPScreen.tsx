import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  permissions: string;
}

export default function SFTPScreen() {
  const [currentPath, setCurrentPath] = useState('/');
  const [selectedHost, setSelectedHost] = useState<string | null>(null);

  const { data: files, isLoading, refetch } = useQuery({
    queryKey: ['sftp', selectedHost, currentPath],
    queryFn: () => api.listSftpFiles(selectedHost!, currentPath),
    enabled: !!selectedHost,
  });

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleItemPress = (item: FileItem) => {
    if (item.type === 'directory') {
      setCurrentPath(`${currentPath}/${item.name}`.replace('//', '/'));
    }
  };

  const renderFileItem = ({ item }: { item: FileItem }) => (
    <TouchableOpacity
      style={styles.fileItem}
      onPress={() => handleItemPress(item)}
    >
      <View style={styles.fileIcon}>
        <Text style={styles.iconText}>
          {item.type === 'directory' ? '📁' : '📄'}
        </Text>
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName}>{item.name}</Text>
        <Text style={styles.fileMeta}>
          {item.type === 'file' ? formatSize(item.size) : 'Directory'}
        </Text>
      </View>
      <Text style={styles.filePermissions}>{item.permissions}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pathText}>{currentPath}</Text>
        {currentPath !== '/' && (
          <TouchableOpacity
            onPress={() => {
              const parts = currentPath.split('/').filter(Boolean);
              parts.pop();
              setCurrentPath('/' + parts.join('/'));
            }}
          >
            <Text style={styles.backButton}>Back</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={files}
        keyExtractor={(item) => item.name}
        renderItem={renderFileItem}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No files</Text>
          </View>
        }
      />
    </View>
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
  pathText: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  backButton: {
    color: '#0ea5e9',
    fontSize: 14,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  fileIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 2,
  },
  fileMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  filePermissions: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
  },
});
