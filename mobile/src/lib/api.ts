import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/api/auth/login', { email, password });
    return response.data;
  },

  register: async (email: string, password: string) => {
    const response = await apiClient.post('/api/auth/register', { email, password });
    return response.data;
  },

  // Hosts
  getHosts: async () => {
    const response = await apiClient.get('/api/hosts');
    return response.data;
  },

  createHost: async (host: any) => {
    const response = await apiClient.post('/api/hosts', host);
    return response.data;
  },

  updateHost: async (id: string, host: any) => {
    const response = await apiClient.put(`/api/hosts/${id}`, host);
    return response.data;
  },

  deleteHost: async (id: string) => {
    await apiClient.delete(`/api/hosts/${id}`);
  },

  // SSH
  connectSSH: async (hostId: string) => {
    const response = await apiClient.post(`/api/ssh/connect/${hostId}`);
    return response.data;
  },

  executeCommand: async (sessionId: string, command: string) => {
    const response = await apiClient.post(`/api/ssh/execute/${sessionId}`, { command });
    return response.data;
  },

  disconnectSSH: async (sessionId: string) => {
    await apiClient.post(`/api/ssh/disconnect/${sessionId}`);
  },

  // SFTP
  listSftpFiles: async (hostId: string, path: string) => {
    const response = await apiClient.get(`/api/sftp/${hostId}/list`, {
      params: { path },
    });
    return response.data;
  },

  downloadSftpFile: async (hostId: string, path: string) => {
    const response = await apiClient.get(`/api/sftp/${hostId}/download`, {
      params: { path },
      responseType: 'blob',
    });
    return response.data;
  },

  uploadSftpFile: async (hostId: string, path: string, file: any) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    const response = await apiClient.post(`/api/sftp/${hostId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Vaults
  getVaults: async () => {
    const response = await apiClient.get('/api/vaults');
    return response.data;
  },

  unlockVault: async (vaultId: string, masterPassword: string) => {
    const response = await apiClient.post(`/api/vaults/${vaultId}/unlock`, {
      masterPassword,
    });
    return response.data;
  },

  // Keys
  getKeys: async () => {
    const response = await apiClient.get('/api/keys');
    return response.data;
  },

  importKey: async (keyData: any) => {
    const response = await apiClient.post('/api/keys/import', keyData);
    return response.data;
  },
};
