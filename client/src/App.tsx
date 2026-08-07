import { emit } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import AuthGuard from "@/components/auth/guard/AuthGuard";
import UnlockDialog from "@/components/auth/UnlockDialog";
import Layout from "@/components/layout/shell/Layout";
import LoginPage from "@/pages/auth/LoginPage";
import RecoveryPage from "@/pages/auth/RecoveryPage";
import RecoveryRevealModal from "@/pages/auth/RecoveryRevealModal";
import RegisterPage from "@/pages/auth/RegisterPage";
import SetupPage from "@/pages/auth/SetupPage";
import EditorPage from "@/pages/EditorPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import HistoryPage from "@/pages/HistoryPage";
import HostsPage from "@/pages/HostsPage";
import KeysPage from "@/pages/KeysPage";
import SftpPage from "@/pages/SftpPage";
import SnippetsPage from "@/pages/SnippetsPage";
import TerminalPage from "@/pages/TerminalPage";
import WorkspacesPage from "@/pages/WorkspacesPage";
import { useAuthStore } from "@/stores/auth/authStore";
import { useSettingsStore } from "@/stores/settings/settingsStore";
import { useShellStore } from "@/stores/terminal/shellStore";
import { useThemeStore } from "@/stores/themeStore";

function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const pendingRecoveryCode = useAuthStore((s) => s.pendingRecoveryCode);
  const pendingRecoveryContext = useAuthStore((s) => s.pendingRecoveryContext);
  const clearRecoveryCode = useAuthStore((s) => s.clearRecoveryCode);
  const initSettings = useSettingsStore((s) => s.initSettings);
  const initTheme = useThemeStore((s) => s.initTheme);
  const detectShells = useShellStore((s) => s.detect);

  useEffect(() => {
    const init = async () => {
      initTheme();
      initSettings();
      restoreSession();
      await detectShells();
      emit("main-ready");
    };
    init();
  }, [restoreSession, initSettings, initTheme, detectShells]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthGuard requireAuth={false} />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/recovery" element={<RecoveryPage />} />
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
            <Route path="editor" element={<EditorPage />} />
            <Route path="*" element={<Navigate to="/hosts" replace />} />
          </Route>
        </Route>
      </Routes>
      <RecoveryRevealModal
        open={!!pendingRecoveryCode}
        recoveryCode={pendingRecoveryCode ?? ""}
        onClose={clearRecoveryCode}
        context={pendingRecoveryContext ?? "signup"}
      />
      <UnlockDialog />
      <Toaster richColors />
    </BrowserRouter>
  );
}

export default App;
