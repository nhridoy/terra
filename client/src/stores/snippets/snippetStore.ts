import { create } from "zustand";

interface Snippet {
  id: string;
  name: string;
  command: string;
  description?: string;
  tags: string[];
  vaultId?: string;
  createdAt: string;
}

interface SnippetState {
  snippets: Snippet[];
  selectedSnippet: Snippet | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;

  fetchSnippets: (vaultId?: string) => Promise<void>;
  selectSnippet: (snippet: Snippet | null) => void;
  createSnippet: (snippet: Partial<Snippet>) => Promise<void>;
  updateSnippet: (id: string, snippet: Partial<Snippet>) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  getFilteredSnippets: () => Snippet[];
}

export const useSnippetStore = create<SnippetState>((set, get) => ({
  snippets: [],
  selectedSnippet: null,
  isLoading: false,
  error: null,
  searchQuery: "",

  fetchSnippets: async () => {},
  selectSnippet: (snippet) => set({ selectedSnippet: snippet }),
  createSnippet: async () => {},
  updateSnippet: async () => {},
  deleteSnippet: async () => {},
  setSearchQuery: (query) => set({ searchQuery: query }),
  getFilteredSnippets: () => {
    const { snippets, searchQuery } = get();
    if (!searchQuery) return snippets;
    const q = searchQuery.toLowerCase();
    return snippets.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.command.toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q),
    );
  },
}));
