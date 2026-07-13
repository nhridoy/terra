// API Client for TermVault Server

const API_BASE = 'http://localhost:8080/api'

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

  // SFTP
  async listFiles(hostId: string, path: string) {
    return this.request<{ files: any[] }>(
      `/sftp/${hostId}/list?path=${encodeURIComponent(path)}`,
    )
  }

  async readFile(hostId: string, path: string) {
    return this.request<{ content: string }>(
      `/sftp/${hostId}/read?path=${encodeURIComponent(path)}`,
    )
  }

  async writeFile(hostId: string, path: string, content: string) {
    return this.request(`/sftp/${hostId}/write`, {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    })
  }

  async uploadFile(
    hostId: string,
    remotePath: string,
    fileName: string,
    content: string,
  ) {
    return this.request(`/sftp/${hostId}/upload`, {
      method: 'POST',
      body: JSON.stringify({ remotePath, fileName, content }),
    })
  }

  async deleteFile(hostId: string, path: string) {
    return this.request(
      `/sftp/${hostId}/delete?path=${encodeURIComponent(path)}`,
      {
        method: 'DELETE',
      },
    )
  }

  async moveFile(hostId: string, oldPath: string, newPath: string) {
    return this.request(`/sftp/${hostId}/move`, {
      method: 'POST',
      body: JSON.stringify({ oldPath, newPath }),
    })
  }

  async createDirectory(hostId: string, parentPath: string, name: string) {
    return this.request(`/sftp/${hostId}/mkdir`, {
      method: 'POST',
      body: JSON.stringify({ parentPath, name }),
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
