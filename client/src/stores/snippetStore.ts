import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { getDeviceId } from '../lib/device'
import { useAuthStore } from './authStore'

interface Snippet {
  id: string
  name: string
  command: string
  description?: string
  tags: string[]
  vaultId?: string
  createdAt: string
}

interface SnippetState {
  snippets: Snippet[]
  selectedSnippet: Snippet | null
  isLoading: boolean
  error: string | null
  searchQuery: string

  fetchSnippets: (vaultId?: string) => Promise<void>
  selectSnippet: (snippet: Snippet | null) => void
  createSnippet: (snippet: Partial<Snippet>) => Promise<void>
  updateSnippet: (id: string, snippet: Partial<Snippet>) => Promise<void>
  deleteSnippet: (id: string) => Promise<void>
  setSearchQuery: (query: string) => void
  getFilteredSnippets: () => Snippet[]
  clearError: () => void
}

function getUserId(): string {
  return useAuthStore.getState().user?.id || ''
}

function normalizeTags(tags: unknown): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) return tags
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags)
      return Array.isArray(parsed) ? parsed : [tags]
    } catch {
      return tags ? [tags] : []
    }
  }
  return []
}

export const useSnippetStore = create<SnippetState>((set, get) => ({
  snippets: [],
  selectedSnippet: null,
  isLoading: false,
  error: null,
  searchQuery: '',

  fetchSnippets: async (_vaultId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const snippets = await invoke<any[]>('list_snippets', { userId: getUserId() })
      set({
        snippets: snippets.map((s) => ({ ...s, tags: normalizeTags(s.tags) })),
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  selectSnippet: (snippet) => set({ selectedSnippet: snippet }),

  createSnippet: async (snippetData) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const result = await invoke<any>('create_snippet', {
        snippet: {
          userId: getUserId(),
          name: snippetData.name || '',
          command: snippetData.command || '',
          description: snippetData.description,
          tags: snippetData.tags ? JSON.stringify(snippetData.tags) : '[]',
        },
        deviceId,
      })
      set({
        snippets: [...get().snippets, { ...result, tags: normalizeTags(result.tags) }],
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  updateSnippet: async (id, snippetData) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const result = await invoke<any>('update_snippet', {
        id,
        snippet: {
          userId: getUserId(),
          name: snippetData.name || '',
          command: snippetData.command || '',
          description: snippetData.description,
          tags: snippetData.tags ? JSON.stringify(snippetData.tags) : '[]',
        },
        deviceId,
      })
      set({
        snippets: get().snippets.map((s) => (s.id === id ? { ...result, tags: normalizeTags(result.tags) } : s)),
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  deleteSnippet: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      await invoke('delete_snippet', { id, deviceId })
      set({
        snippets: get().snippets.filter((s) => s.id !== id),
        selectedSnippet:
          get().selectedSnippet?.id === id ? null : get().selectedSnippet,
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  getFilteredSnippets: () => {
    const { snippets, searchQuery } = get()
    if (!searchQuery) return snippets

    const query = searchQuery.toLowerCase()
    return snippets.filter(
      (snippet) =>
        snippet.name.toLowerCase().includes(query) ||
        snippet.command.toLowerCase().includes(query) ||
        snippet.description?.toLowerCase().includes(query) ||
        snippet.tags.some((tag) => tag.toLowerCase().includes(query)),
    )
  },

  clearError: () => set({ error: null }),
}))
