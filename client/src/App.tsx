import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import AuthGuard from "./components/auth/AuthGuard";
import Layout from "./components/layout/Layout";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import HistoryPage from "./pages/HistoryPage";
import HostsPage from "./pages/HostsPage";
import KeysPage from "./pages/KeysPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SftpPage from "./pages/SftpPage";
import SnippetsPage from "./pages/SnippetsPage";
import TerminalPage from "./pages/TerminalPage";
import WorkspacesPage from "./pages/WorkspacesPage";
import { useAuthStore } from "./stores/authStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useShellStore } from "./stores/shellStore";
import { useThemeStore } from "./stores/themeStore";

function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const initSettings = useSettingsStore((s) => s.initSettings);
  const initTheme = useThemeStore((s) => s.initTheme);
  const detectShells = useShellStore((s) => s.detect);

  useEffect(() => {
    restoreSession();
    initSettings();
    initTheme();
    detectShells();
  }, [restoreSession, initSettings, initTheme, detectShells]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthGuard requireAuth={false} />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route element={<AuthGuard requireAuth={true} />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/hosts" replace />} />
            <Route path="hosts" element={<HostsPage />} />
            <Route path="workspaces" element={<WorkspacesPage />} />
            <Route path="snippets" element={<SnippetsPage />} />
            <Route path="keys" element={<KeysPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="terminal" element={<TerminalPage />} />
            <Route path="sftp" element={<SftpPage />} />
            <Route path="*" element={<Navigate to="/hosts" replace />} />
          </Route>
        </Route>
      </Routes>
      <Toaster richColors />
    </BrowserRouter>
  );
}

export default App;
