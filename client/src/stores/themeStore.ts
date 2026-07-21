import { create } from 'zustand'

type Theme =
  | 'dark'
  | 'light'
  | 'midnight'
  | 'dracula'
  | 'nord'
  | 'solarized'
  | 'monokai'
  | 'tokyo-night'
  | 'gruvbox'
  | 'catppuccin'
  | 'rose-pine'
  | 'onedark'
  | 'ayu-mirage'
  | 'palenight'
  | 'material-ocean'
  | 'github-dark'
  | 'github-light'
  | 'cyberpunk'
  | 'neon'
  | 'retro'
  | 'forest'
  | 'ocean'
  | 'sunset'
  | 'arctic'
  | 'volcanic'
  | 'pastel'
  | 'neon-pink'
  | 'matrix'
  | 'hacker'
  | 'warm'

interface ThemeState {
  currentTheme: Theme
  setTheme: (theme: Theme) => void
}

const themes: Record<Theme, { name: string; colors: Record<string, string> }> =
  {
    dark: {
      name: 'Dark',
      colors: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        primary: '#0ea5e9',
        secondary: '#64748b',
        accent: '#8b5cf6',
        error: '#ef4444',
        warning: '#f59e0b',
        success: '#22c55e',
        border: '#1e293b',
        card: '#1e293b',
      },
    },
    light: {
      name: 'Light',
      colors: {
        background: '#ffffff',
        foreground: '#0f172a',
        primary: '#0284c7',
        secondary: '#64748b',
        accent: '#7c3aed',
        error: '#dc2626',
        warning: '#d97706',
        success: '#16a34a',
        border: '#e2e8f0',
        card: '#f8fafc',
      },
    },
    midnight: {
      name: 'Midnight',
      colors: {
        background: '#0a0a0a',
        foreground: '#a0a0a0',
        primary: '#00ff00',
        secondary: '#404040',
        accent: '#00ffff',
        error: '#ff0000',
        warning: '#ffff00',
        success: '#00ff00',
        border: '#1a1a1a',
        card: '#141414',
      },
    },
    dracula: {
      name: 'Dracula',
      colors: {
        background: '#282a36',
        foreground: '#f8f8f2',
        primary: '#bd93f9',
        secondary: '#6272a4',
        accent: '#ff79c6',
        error: '#ff5555',
        warning: '#f1fa8c',
        success: '#50fa7b',
        border: '#44475a',
        card: '#2e303e',
      },
    },
    nord: {
      name: 'Nord',
      colors: {
        background: '#2e3440',
        foreground: '#d8dee9',
        primary: '#88c0d0',
        secondary: '#4c566a',
        accent: '#b48ead',
        error: '#bf616a',
        warning: '#ebcb8b',
        success: '#a3be8c',
        border: '#3b4252',
        card: '#333a47',
      },
    },
    solarized: {
      name: 'Solarized',
      colors: {
        background: '#002b36',
        foreground: '#839496',
        primary: '#268bd2',
        secondary: '#586e75',
        accent: '#6c71c4',
        error: '#dc322f',
        warning: '#b58900',
        success: '#859900',
        border: '#073642',
        card: '#073642',
      },
    },
    monokai: {
      name: 'Monokai',
      colors: {
        background: '#272822',
        foreground: '#f8f8f2',
        primary: '#a6e22e',
        secondary: '#75715e',
        accent: '#ae81ff',
        error: '#f92672',
        warning: '#e6db74',
        success: '#a6e22e',
        border: '#3e3d32',
        card: '#2d2e27',
      },
    },
    'tokyo-night': {
      name: 'Tokyo Night',
      colors: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        primary: '#7aa2f7',
        secondary: '#565f89',
        accent: '#bb9af7',
        error: '#f7768e',
        warning: '#e0af68',
        success: '#9ece6a',
        border: '#24283b',
        card: '#1f2335',
      },
    },
    gruvbox: {
      name: 'Gruvbox',
      colors: {
        background: '#282828',
        foreground: '#ebdbb2',
        primary: '#b8bb26',
        secondary: '#928374',
        accent: '#d3869b',
        error: '#fb4934',
        warning: '#fabd2f',
        success: '#b8bb26',
        border: '#3c3836',
        card: '#2d2d2d',
      },
    },
    catppuccin: {
      name: 'Catppuccin',
      colors: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        primary: '#89b4fa',
        secondary: '#6c7086',
        accent: '#cba6f7',
        error: '#f38ba8',
        warning: '#f9e2af',
        success: '#a6e3a1',
        border: '#313244',
        card: '#181825',
      },
    },
    'rose-pine': {
      name: 'Rose Pine',
      colors: {
        background: '#191724',
        foreground: '#e0def4',
        primary: '#9ccfd8',
        secondary: '#6e6a86',
        accent: '#c4a7e7',
        error: '#eb6f92',
        warning: '#f6c177',
        success: '#31748f',
        border: '#26233a',
        card: '#1f1d2e',
      },
    },
    onedark: {
      name: 'One Dark',
      colors: {
        background: '#282c34',
        foreground: '#abb2bf',
        primary: '#61afef',
        secondary: '#5c6370',
        accent: '#c678dd',
        error: '#e06c75',
        warning: '#e5c07b',
        success: '#98c379',
        border: '#3e4451',
        card: '#21252b',
      },
    },
    'ayu-mirage': {
      name: 'Ayu Mirage',
      colors: {
        background: '#1f2430',
        foreground: '#cbccc6',
        primary: '#36d399',
        secondary: '#5c6773',
        accent: '#ffcc66',
        error: '#ff3333',
        warning: '#ffcc66',
        success: '#36d399',
        border: '#2b3040',
        card: '#242936',
      },
    },
    palenight: {
      name: 'Palenight',
      colors: {
        background: '#292d3e',
        foreground: '#a6accd',
        primary: '#82aaff',
        secondary: '#676e95',
        accent: '#c792ea',
        error: '#ff5370',
        warning: '#ffcb6b',
        success: '#c3e88d',
        border: '#343b58',
        card: '#24283b',
      },
    },
    'material-ocean': {
      name: 'Material Ocean',
      colors: {
        background: '#1a1c25',
        foreground: '#a6accd',
        primary: '#82aaff',
        secondary: '#676e95',
        accent: '#c792ea',
        error: '#ff5370',
        warning: '#ffcb6b',
        success: '#c3e88d',
        border: '#292d3e',
        card: '#1e2030',
      },
    },
    'github-dark': {
      name: 'GitHub Dark',
      colors: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        primary: '#58a6ff',
        secondary: '#8b949e',
        accent: '#bc8cff',
        error: '#f85149',
        warning: '#d29922',
        success: '#3fb950',
        border: '#21262d',
        card: '#161b22',
      },
    },
    'github-light': {
      name: 'GitHub Light',
      colors: {
        background: '#ffffff',
        foreground: '#24292f',
        primary: '#0969da',
        secondary: '#57606a',
        accent: '#8250df',
        error: '#cf222e',
        warning: '#9a6700',
        success: '#116329',
        border: '#d0d7de',
        card: '#f6f8fa',
      },
    },
    cyberpunk: {
      name: 'Cyberpunk',
      colors: {
        background: '#0a0a0f',
        foreground: '#00ff9f',
        primary: '#00ffff',
        secondary: '#ff00ff',
        accent: '#ffff00',
        error: '#ff0040',
        warning: '#ff8800',
        success: '#00ff9f',
        border: '#1a1a2e',
        card: '#12121a',
      },
    },
    neon: {
      name: 'Neon',
      colors: {
        background: '#0d0221',
        foreground: '#f0f0f0',
        primary: '#00d4ff',
        secondary: '#ff00ff',
        accent: '#ffff00',
        error: '#ff0055',
        warning: '#ff9900',
        success: '#00ff88',
        border: '#1a0533',
        card: '#0f0326',
      },
    },
    retro: {
      name: 'Retro',
      colors: {
        background: '#2b2b2b',
        foreground: '#f8f8f2',
        primary: '#00ff00',
        secondary: '#008000',
        accent: '#ffff00',
        error: '#ff0000',
        warning: '#ff8800',
        success: '#00ff00',
        border: '#3c3c3c',
        card: '#2f2f2f',
      },
    },
    forest: {
      name: 'Forest',
      colors: {
        background: '#1a2f1a',
        foreground: '#c8e6c9',
        primary: '#4caf50',
        secondary: '#2e7d32',
        accent: '#81c784',
        error: '#ef5350',
        warning: '#ffb74d',
        success: '#66bb6a',
        border: '#2d5a2d',
        card: '#1e3a1e',
      },
    },
    ocean: {
      name: 'Ocean',
      colors: {
        background: '#0a1929',
        foreground: '#b3d4fc',
        primary: '#2196f3',
        secondary: '#1565c0',
        accent: '#64b5f6',
        error: '#f44336',
        warning: '#ff9800',
        success: '#4caf50',
        border: '#1e3a5f',
        card: '#0d2137',
      },
    },
    sunset: {
      name: 'Sunset',
      colors: {
        background: '#1a0a0a',
        foreground: '#ffd4c4',
        primary: '#ff6b35',
        secondary: '#d35400',
        accent: '#ff8c61',
        error: '#e74c3c',
        warning: '#f39c12',
        success: '#27ae60',
        border: '#3d1a1a',
        card: '#200f0f',
      },
    },
    arctic: {
      name: 'Arctic',
      colors: {
        background: '#e8f4f8',
        foreground: '#1a3a4a',
        primary: '#0288d1',
        secondary: '#546e7a',
        accent: '#00acc1',
        error: '#d32f2f',
        warning: '#f57c00',
        success: '#388e3c',
        border: '#b3e5fc',
        card: '#f5f9fc',
      },
    },
    volcanic: {
      name: 'Volcanic',
      colors: {
        background: '#1a0f0f',
        foreground: '#ffcdd2',
        primary: '#ff5722',
        secondary: '#bf360c',
        accent: '#ff8a65',
        error: '#b71c1c',
        warning: '#ff6f00',
        success: '#2e7d32',
        border: '#4a1a1a',
        card: '#201414',
      },
    },
    pastel: {
      name: 'Pastel',
      colors: {
        background: '#fafafa',
        foreground: '#37474f',
        primary: '#7986cb',
        secondary: '#90a4ae',
        accent: '#ce93d8',
        error: '#ef9a9a',
        warning: '#fff59d',
        success: '#a5d6a7',
        border: '#e0e0e0',
        card: '#ffffff',
      },
    },
    'neon-pink': {
      name: 'Neon Pink',
      colors: {
        background: '#0a0010',
        foreground: '#ff69b4',
        primary: '#ff1493',
        secondary: '#c71585',
        accent: '#ff69b4',
        error: '#ff0000',
        warning: '#ff8c00',
        success: '#00ff00',
        border: '#1a0020',
        card: '#0f0015',
      },
    },
    matrix: {
      name: 'Matrix',
      colors: {
        background: '#000000',
        foreground: '#00ff00',
        primary: '#00ff00',
        secondary: '#008000',
        accent: '#00ff41',
        error: '#ff0000',
        warning: '#ffff00',
        success: '#00ff00',
        border: '#003300',
        card: '#001100',
      },
    },
    hacker: {
      name: 'Hacker',
      colors: {
        background: '#0a0a0a',
        foreground: '#00ff00',
        primary: '#00ff00',
        secondary: '#009900',
        accent: '#00ffff',
        error: '#ff0000',
        warning: '#ffff00',
        success: '#00ff00',
        border: '#003300',
        card: '#0d0d0d',
      },
    },
    warm: {
      name: 'Warm',
      colors: {
        background: '#1a1510',
        foreground: '#e8dcc8',
        primary: '#d4a574',
        secondary: '#8b7355',
        accent: '#c9956b',
        error: '#c0392b',
        warning: '#d4a017',
        success: '#27ae60',
        border: '#2d251c',
        card: '#1f1a14',
      },
    },
  }

export const useThemeStore = create<ThemeState>((set) => ({
  currentTheme: (localStorage.getItem('theme') as Theme) || 'dark',

  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    set({ currentTheme: theme })

    // Apply theme to document
    const themeColors = themes[theme].colors
    const root = document.documentElement
    root.style.setProperty('--background', themeColors.background)
    root.style.setProperty('--foreground', themeColors.foreground)
    root.style.setProperty('--primary', themeColors.primary)
    root.style.setProperty('--secondary', themeColors.secondary)
    root.style.setProperty('--accent', themeColors.accent)
    root.style.setProperty('--error', themeColors.error)
    root.style.setProperty('--warning', themeColors.warning)
    root.style.setProperty('--success', themeColors.success)
    root.style.setProperty('--border', themeColors.border)
    root.style.setProperty('--card', themeColors.card)
  },
}))

export type { Theme }
export { themes }
