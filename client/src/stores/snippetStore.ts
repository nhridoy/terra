import { create } from 'zustand'
import api from '../lib/api'

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

export const useSnippetStore = create<SnippetState>((set, get) => ({
  snippets: [],
  selectedSnippet: null,
  isLoading: false,
  error: null,
  searchQuery: '',

  fetchSnippets: async (vaultId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.listSnippets(vaultId)
      set({ snippets: result.snippets, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  selectSnippet: (snippet) => set({ selectedSnippet: snippet }),

  createSnippet: async (snippetData) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.createSnippet(snippetData)
      set({
        snippets: [...get().snippets, result.snippet],
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  updateSnippet: async (id, snippetData) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.updateSnippet(id, snippetData)
      set({
        snippets: get().snippets.map((s) => (s.id === id ? result.snippet : s)),
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  deleteSnippet: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.deleteSnippet(id)
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
