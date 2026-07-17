// API Client for TermVault Server

const API_BASE = 'http://localhost:8080/api'

const mimeTypes: Record<string, string> = {
  'txt': 'text/plain',
  'html': 'text/html',
  'css': 'text/css',
  'js': 'application/javascript',
  'json': 'application/json',
  'xml': 'application/xml',
  'pdf': 'application/pdf',
  'zip': 'application/zip',
  'gz': 'application/gzip',
  'tar': 'application/x-tar',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'webp': 'image/webp',
  'mp3': 'audio/mpeg',
  'mp4': 'video/mp4',
  'woff': 'font/woff',
  'woff2': 'font/woff2',
  'ttf': 'font/ttf',
}

class ApiClient {
  private token: string | null = null
  private refreshToken: string | null = null

  setTokens(token: string, refreshToken: string) {
    this.token = token
    this.refreshToken = refreshToken
    localStorage.setItem('token', token)
    localStorage.setItem('refreshToken', refreshToken)
  }

  getTokens() {
    return {
      token: this.token || localStorage.getItem('token'),
      refreshToken: this.refreshToken || localStorage.getItem('refreshToken'),
    }
  }

  clearTokens() {
    this.token = null
    this.refreshToken = null
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const { token } = this.getTokens()

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })

    const data = await response.json()

    if (!response.ok) {
      const err = new Error(data.error || 'Request failed') as Error & { status?: number }
      err.status = response.status
      throw err
    }

    return data
  }

  // Auth
  async register(email: string, username: string, password: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    })
  }

  async login(email: string, password: string) {
    const data = await this.request<{
      token: string
      refreshToken: string
      userId: string
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    this.setTokens(data.token, data.refreshToken)
    return data
  }

  // Hosts
  async listHosts(vaultId?: string) {
    const query = vaultId ? `?vaultId=${encodeURIComponent(vaultId)}` : ''
    return this.request<{ hosts: any[] }>(`/hosts${query}`)
  }

  async createHost(host: any) {
    return this.request<{ host: any }>('/hosts', {
      method: 'POST',
      body: JSON.stringify(host),
    })
  }

  async updateHost(id: string, host: any) {
    return this.request<{ host: any }>(`/hosts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(host),
    })
  }

  async deleteHost(id: string) {
    return this.request(`/hosts/${id}`, {
      method: 'DELETE',
    })
  }

  // Groups
  async listGroups(vaultId?: string) {
    const query = vaultId ? `?vaultId=${encodeURIComponent(vaultId)}` : ''
    return this.request<{ groups: any[] }>(`/groups${query}`)
  }

  async createGroup(group: any) {
    return this.request<{ group: any }>('/groups', {
      method: 'POST',
      body: JSON.stringify(group),
    })
  }

  async updateGroup(id: string, group: any) {
    return this.request<{ group: any }>(`/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(group),
    })
  }

  async deleteGroup(id: string) {
    return this.request(`/groups/${id}`, {
      method: 'DELETE',
    })
  }

  // Vaults
  async listVaults() {
    return this.request<{ vaults: any[] }>('/vaults')
  }

  async createVault(vault: any) {
    return this.request<{ vault: any }>('/vaults', {
      method: 'POST',
      body: JSON.stringify(vault),
    })
  }

  async updateVault(id: string, vault: any) {
    return this.request<{ vault: any }>(`/vaults/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vault),
    })
  }

  async deleteVault(id: string) {
    return this.request(`/vaults/${id}`, {
      method: 'DELETE',
    })
  }

  async getVaultData(id: string) {
    return this.request<{ data: any }>(`/vaults/${id}/data`)
  }

  async unlockVault(id: string, password: string) {
    return this.request(`/vaults/${id}/unlock`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
  }

  // Keys
  async listKeys(vaultId?: string) {
    const query = vaultId ? `?vaultId=${encodeURIComponent(vaultId)}` : ''
    return this.request<{ keys: any[] }>(`/keys${query}`)
  }

  async importKey(key: any) {
    return this.request<{ key: any }>('/keys', {
      method: 'POST',
      body: JSON.stringify(key),
    })
  }

  async generateKey(data: { name: string; description?: string; keyType: string; vaultId?: string }) {
    return this.request<{ key: any; privateKey: string }>('/keys/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteKey(id: string) {
    return this.request(`/keys/${id}`, {
      method: 'DELETE',
    })
  }

  // Snippets
  async listSnippets(vaultId?: string) {
    const query = vaultId ? `?vaultId=${encodeURIComponent(vaultId)}` : ''
    return this.request<{ snippets: any[] }>(`/snippets${query}`)
  }

  async createSnippet(snippet: any) {
    return this.request<{ snippet: any }>('/snippets', {
      method: 'POST',
      body: JSON.stringify(snippet),
    })
  }

  async updateSnippet(id: string, snippet: any) {
    return this.request<{ snippet: any }>(`/snippets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(snippet),
    })
  }

  async deleteSnippet(id: string) {
    return this.request(`/snippets/${id}`, {
      method: 'DELETE',
    })
  }

  // Workspaces
  async listWorkspaces(vaultId?: string) {
    const query = vaultId ? `?vaultId=${encodeURIComponent(vaultId)}` : ''
    return this.request<{ workspaces: any[] }>(`/workspaces${query}`)
  }

  async createWorkspace(workspace: any) {
    return this.request<{ workspace: any }>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(workspace),
    })
  }

  async updateWorkspace(id: string, workspace: any) {
    return this.request<{ workspace: any }>(`/workspaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workspace),
    })
  }

  async deleteWorkspace(id: string) {
    return this.request(`/workspaces/${id}`, {
      method: 'DELETE',
    })
  }

  // Quick Presets (tab groups)
  async listTabGroups(vaultId?: string) {
    const query = vaultId ? `?vaultId=${encodeURIComponent(vaultId)}` : ''
    return this.request<{ tabGroups: any[] }>(`/tab-groups${query}`)
  }

  async createTabGroup(tabGroup: any) {
    return this.request<{ tabGroup: any }>('/tab-groups', {
      method: 'POST',
      body: JSON.stringify(tabGroup),
    })
  }

  async updateTabGroup(id: string, tabGroup: any) {
    return this.request<{ tabGroup: any }>(`/tab-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tabGroup),
    })
  }

  async renameTabGroup(id: string, name: string) {
    return this.request<{ tabGroup: any }>(`/tab-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    })
  }

  async deleteTabGroup(id: string) {
    return this.request(`/tab-groups/${id}`, {
      method: 'DELETE',
    })
  }

  // SFTP — all operations go through Tauri invoke (direct SSH from Rust backend)

  async listFiles(hostId: string, path: string) {
    const { invoke } = await import('@tauri-apps/api/core')
    const files = await invoke<any[]>('sftp_list', { sessionId: hostId, path })
    return { files }
  }

  async readFile(hostId: string, path: string) {
    const { invoke } = await import('@tauri-apps/api/core')
    const content = await invoke<string>('sftp_read', { sessionId: hostId, path })
    return { content }
  }

  async writeFile(hostId: string, path: string, content: string) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('sftp_write', { sessionId: hostId, path, content })
  }

  async uploadFile(hostId: string, remotePath: string, fileName: string, content: string) {
    const { invoke } = await import('@tauri-apps/api/core')
    const fullPath = remotePath.endsWith('/') ? `${remotePath}${fileName}` : `${remotePath}/${fileName}`
    await invoke('sftp_write', { sessionId: hostId, path: fullPath, content })
  }

  async uploadFileWithProgress(
    hostId: string,
    remotePath: string,
    file: File,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core')
    const total = file.size
    if (onProgress) onProgress(0, total)

    const content = await file.text()
    const fullPath = remotePath.endsWith('/') ? `${remotePath}${file.name}` : `${remotePath}/${file.name}`
    await invoke('sftp_write', { sessionId: hostId, path: fullPath, content })

    if (onProgress) onProgress(total, total)
  }

  async downloadFileBlob(hostId: string, path: string, fileName: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core')
    const content = await invoke<string>('sftp_read', { sessionId: hostId, path })
    const bytes = new TextEncoder().encode(content)
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const mime = mimeTypes[ext] || 'application/octet-stream'
    const blob = new Blob([bytes], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async deleteFile(hostId: string, path: string) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('sftp_delete', { sessionId: hostId, path })
  }

  async moveFile(hostId: string, oldPath: string, newPath: string) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('sftp_rename', { sessionId: hostId, oldPath, newPath })
  }

  async createDirectory(hostId: string, parentPath: string, name: string) {
    const { invoke } = await import('@tauri-apps/api/core')
    const fullPath = parentPath.endsWith('/') ? `${parentPath}${name}` : `${parentPath}/${name}`
    await invoke('sftp_mkdir', { sessionId: hostId, path: fullPath })
  }

  async copyFile(hostId: string, srcPath: string, dstPath: string) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('sftp_copy', { sessionId: hostId, srcPath, dstPath })
  }

  async crossHostCopy(
    srcHostId: string, srcPath: string,
    dstHostId: string, dstPath: string,
  ) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('sftp_cross_copy', {
      srcSessionId: srcHostId,
      srcPath,
      dstSessionId: dstHostId,
      dstPath,
    })
  }

  async crossHostMove(
    srcHostId: string, srcPath: string,
    dstHostId: string, dstPath: string,
  ) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('sftp_cross_copy', {
      srcSessionId: srcHostId,
      srcPath,
      dstSessionId: dstHostId,
      dstPath,
    })
  }

  // Settings
  async getSettings() {
    return this.request<{ settings: any }>('/settings')
  }

  async updateSettings(settings: any) {
    return this.request<{ settings: any }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  }

  // Teams
  async listTeams() {
    return this.request<{ teams: any[] }>('/teams')
  }

  async createTeam(team: any) {
    return this.request<{ team: any }>('/teams', {
      method: 'POST',
      body: JSON.stringify(team),
    })
  }

  async updateTeam(id: string, team: any) {
    return this.request<{ team: any }>(`/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(team),
    })
  }

  async deleteTeam(id: string) {
    return this.request(`/teams/${id}`, {
      method: 'DELETE',
    })
  }

  async addTeamMember(teamId: string, member: any) {
    return this.request<{ member: any }>(`/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify(member),
    })
  }

  async removeTeamMember(teamId: string, userId: string) {
    return this.request(`/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    })
  }

  async updateTeamMemberRole(teamId: string, userId: string, role: string) {
    return this.request(`/teams/${teamId}/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    })
  }

  async leaveTeam(teamId: string) {
    return this.request(`/teams/${teamId}/leave`, {
      method: 'POST',
    })
  }

  // Shared Vaults
  async listSharedVaults(teamId: string) {
    return this.request<{ vaults: any[] }>(`/teams/${teamId}/vaults`)
  }

  async createSharedVault(vault: any) {
    return this.request<{ vault: any }>(`/teams/${vault.teamId}/vaults`, {
      method: 'POST',
      body: JSON.stringify(vault),
    })
  }

  async updateSharedVault(id: string, vault: any) {
    return this.request<{ vault: any }>(`/shared-vaults/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vault),
    })
  }

  async deleteSharedVault(id: string) {
    return this.request(`/shared-vaults/${id}`, {
      method: 'DELETE',
    })
  }

  async addSharedVaultMember(vaultId: string, member: any) {
    return this.request<{ member: any }>(`/shared-vaults/${vaultId}/members`, {
      method: 'POST',
      body: JSON.stringify(member),
    })
  }

  async removeSharedVaultMember(vaultId: string, userId: string) {
    return this.request(`/shared-vaults/${vaultId}/members/${userId}`, {
      method: 'DELETE',
    })
  }

  // Session Logs
  async listSessionLogs(opts: { hostId?: string; vaultId?: string } = {}) {
    const params = new URLSearchParams()
    if (opts.hostId) params.set('hostId', opts.hostId)
    if (opts.vaultId) params.set('vaultId', opts.vaultId)
    const query = params.toString()
    return this.request<{ logs: any[] }>(`/sessions${query ? `?${query}` : ''}`)
  }

  async getSessionLog(id: string) {
    return this.request<{ log: any }>(`/sessions/${id}`)
  }

  async deleteSessionLog(id: string) {
    return this.request(`/sessions/${id}`, {
      method: 'DELETE',
    })
  }

  // OAuth (placeholder)
  async oauthLogin(provider: string, code: string) {
    return this.request<{ user: { id: string; email: string; username?: string } }>(
      `/auth/oauth/${provider}`,
      {
        method: 'POST',
        body: JSON.stringify({ code }),
      },
    )
  }
}

export const api = new ApiClient()
export default api
