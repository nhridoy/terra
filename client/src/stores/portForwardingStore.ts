import { create } from "zustand";

export interface PortForward {
  id: string;
  sessionId: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  active: boolean;
}

interface PortForwardingState {
  forwards: PortForward[];
  isLoading: boolean;
  error: string | null;

  loadForwards: () => Promise<void>;
  startForward: (
    sessionId: string,
    localPort: number,
    remoteHost: string,
    remotePort: number,
  ) => Promise<PortForward>;
  stopForward: (forwardId: string) => Promise<void>;
  toggleForward: (forwardId: string) => Promise<void>;
  clearError: () => void;
}

export const usePortForwardingStore = create<PortForwardingState>((_set) => ({
  forwards: [],
  isLoading: false,
  error: null,

  loadForwards: async () => {},
  startForward: async (_sid, _lp, _rh, _rp) => ({
    id: "",
    sessionId: "",
    localPort: 0,
    remoteHost: "",
    remotePort: 0,
    active: false,
  }),
  stopForward: async () => {},
  toggleForward: async () => {},
  clearError: () => {},
}));
