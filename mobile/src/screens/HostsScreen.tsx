import React from 'react';
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

export default function HostsScreen() {
  const { data: hosts, isLoading, refetch } = useQuery({
    queryKey: ['hosts'],
    queryFn: api.getHosts,
  });

  const handleConnect = (host: any) => {
    // Navigate to terminal with host
    console.log('Connect to:', host.name);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={hosts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.hostCard}
            onPress={() => handleConnect(item)}
          >
            <View style={styles.hostInfo}>
              <Text style={styles.hostName}>{item.name}</Text>
              <Text style={styles.hostAddress}>
                {item.username}@{item.hostname}:{item.port}
              </Text>
            </View>
            <View style={styles.statusIndicator} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hosts configured</Text>
            <Text style={styles.emptySubtext}>
              Add a host to get started
            </Text>
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
  hostCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    margin: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hostInfo: {
    flex: 1,
  },
  hostName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  hostAddress: {
    fontSize: 14,
    color: '#64748b',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
  },
});
