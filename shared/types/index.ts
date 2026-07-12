// Host types
export interface Host {
  id: string;
  userId: string;
  teamId?: string;
  groupId?: string;
  name: string;
  address: string;
  port: number;
  username?: string;
  tags: string[];
  color?: string;
  icon?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHostRequest {
  name: string;
  address: string;
  port?: number;
  username?: string;
  groupId?: string;
  tags?: string[];
  color?: string;
  icon?: string;
}

export interface UpdateHostRequest extends Partial<CreateHostRequest> {}

// Group types
export interface Group {
  id: string;
  userId: string;
  teamId?: string;
  parentId?: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface CreateGroupRequest {
  name: string;
  parentId?: string;
}

export interface UpdateGroupRequest extends Partial<CreateGroupRequest> {}

// Vault types
export interface Vault {
  id: string;
  userId: string;
  teamId?: string;
  name: string;
  description?: string;
  encryptedData: string;
  iv: string;
  salt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVaultRequest {
  name: string;
  description?: string;
  encryptedData: string;
  iv: string;
  salt: string;
}

export interface UpdateVaultRequest extends Partial<CreateVaultRequest> {}

// Keychain types
export interface Key {
  id: string;
  userId: string;
  teamId?: string;
  name: string;
  keyType: 'rsa' | 'ed25519' | 'ecdsa';
  publicKey: string;
  encryptedPrivateKey?: string;
  fingerprint: string;
  createdAt: string;
}

export interface ImportKeyRequest {
  name: string;
  keyType: 'rsa' | 'ed25519' | 'ecdsa';
  publicKey: string;
  encryptedPrivateKey?: string;
  fingerprint: string;
}

// Snippet types
export interface Snippet {
  id: string;
  userId: string;
  name: string;
  command: string;
  description?: string;
  tags: string[];
  createdAt: string;
}

export interface CreateSnippetRequest {
  name: string;
  command: string;
  description?: string;
  tags?: string[];
}

export interface UpdateSnippetRequest extends Partial<CreateSnippetRequest> {}

// Workspace types
export interface Workspace {
  id: string;
  userId: string;
  name: string;
  layout: WorkspaceLayout;
  hostIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceLayout {
  tabs: WorkspaceTab[];
  split?: 'horizontal' | 'vertical';
}

export interface WorkspaceTab {
  hostId: string;
  title: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  layout: WorkspaceLayout;
  hostIds: string[];
}

export interface UpdateWorkspaceRequest extends Partial<CreateWorkspaceRequest> {}

// Session types
export interface Session {
  id: string;
  userId: string;
  hostId: string;
  startedAt: string;
  endedAt?: string;
  data?: string;
  sizeBytes?: number;
}

// Settings types
export interface Settings {
  id: string;
  userId: string;
  theme: string;
  fontFamily: string;
  fontSize: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  keybindings: Record<string, string>;
}

export interface UpdateSettingsRequest {
  theme?: string;
  fontFamily?: string;
  fontSize?: number;
  cursorStyle?: 'block' | 'underline' | 'bar';
  keybindings?: Record<string, string>;
}

// Team types
export interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  publicKey: string;
  createdAt: string;
}

export interface CreateTeamRequest {
  name: string;
}

export interface AddTeamMemberRequest {
  userId: string;
  role?: 'admin' | 'member' | 'viewer';
}

// User types
export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  srpProof: string;
}

export interface AuthResponse {
  token: string;
  serverProof: string;
  encryptedPrivateKey: string;
  encryptedPersonalKey: string;
  publicKey: string;
  nonce: string;
  salt: string;
}

// API types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// WebSocket types
export interface WSMessage {
  type: string;
  data?: any;
}

export interface SSHConnectMessage {
  type: 'connect';
  hostId: string;
  columns: number;
  rows: number;
}

export interface SSHInputMessage {
  type: 'input';
  data: string;
}

export interface SSHResizeMessage {
  type: 'resize';
  cols: number;
  rows: number;
}

export interface SSHOutputMessage {
  type: 'output';
  data: string;
}

export interface SSHDisconnectMessage {
  type: 'disconnect';
  reason: string;
}
