import { useCallback, useEffect, useState } from "react";
import { confirmDelete } from "../../lib/confirmDelete";
import { useTerminalStore } from "../../stores/terminalStore";
import { useThemeStore } from "../../stores/themeStore";
import { Button } from "../ui/Button";
import settingsTabs from "./SettingsTabs";
import AdvancedTab from "./tabs/AdvancedTab";
import AppearanceTab from "./tabs/AppearanceTab";
import SecurityTab from "./tabs/SecurityTab";
import SshTab from "./tabs/SshTab";
import TerminalTab from "./tabs/TerminalTab";

interface SettingsPanelProps {
  onClose: () => void;
}

interface KnownHost {
  host: string;
  port: number;
  fingerprint: string;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { currentTheme, setTheme } = useThemeStore();
  const { tabs, closeAllTabs } = useTerminalStore();

  const [activeTab, setActiveTab] = useState<
    "appearance" | "terminal" | "ssh" | "security" | "advanced"
  >("appearance");

  // Appearance state
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState("JetBrains Mono");

  // Terminal state
  const [cursorStyle, setCursorStyle] = useState("block");
  const [cursorBlink, setCursorBlink] = useState(true);
  const [scrollback, setScrollback] = useState(10000);
  const [bellStyle, setBellStyle] = useState("none");

  // SSH known hosts state
  const [knownHosts, setKnownHosts] = useState<KnownHost[]>([]);
  const [knownHostsLoading, setKnownHostsLoading] = useState(false);

  const loadKnownHosts = useCallback(async () => {
    try {
      setKnownHostsLoading(true);
      setKnownHosts([]);
    } catch (err) {
      console.error("Failed to load known hosts:", err);
    } finally {
      setKnownHostsLoading(false);
    }
  }, []);

  const handleRemoveKnownHost = async (host: string, port: number) => {
    if (
      await confirmDelete(
        `Remove known host for ${host}:${port}? You will be prompted to verify their identity on next connection.`,
      )
    ) {
      try {
        setKnownHosts((prev) =>
          prev.filter((h) => !(h.host === host && h.port === port)),
        );
      } catch (err) {
        console.error("Failed to remove known host:", err);
      }
    }
  };

  const handleClearAllKnownHosts = async () => {
    if (
      await confirmDelete(
        "Clear ALL known hosts? You will be prompted to verify identity for every host on next connection.",
      )
    ) {
      setKnownHosts([]);
    }
  };

  useEffect(() => {
    const savedFontSize = localStorage.getItem("termvault.fontSize");
    const savedFontFamily = localStorage.getItem("termvault.fontFamily");
    const savedCursorStyle = localStorage.getItem("termvault.cursorStyle");
    const savedCursorBlink = localStorage.getItem("termvault.cursorBlink");
    const savedScrollback = localStorage.getItem("termvault.scrollback");
    const savedBellStyle = localStorage.getItem("termvault.bellStyle");

    if (savedFontSize) setFontSize(parseInt(savedFontSize, 10));
    if (savedFontFamily) setFontFamily(savedFontFamily);
    if (savedCursorStyle)
      setCursorStyle(savedCursorStyle as "block" | "underline" | "bar");
    if (savedCursorBlink) setCursorBlink(savedCursorBlink === "true");
    if (savedScrollback) setScrollback(parseInt(savedScrollback, 10));
    if (savedBellStyle)
      setBellStyle(savedBellStyle as "none" | "sound" | "visual");
  }, []);

  useEffect(() => {
    if (activeTab === "ssh") loadKnownHosts();
  }, [activeTab, loadKnownHosts]);

  const saveSetting = (key: string, value: string) => {
    localStorage.setItem(`termvault.${key}`, value);
  };

  const handleFontSizeChange = (value: number) => {
    setFontSize(value);
    saveSetting("fontSize", value.toString());
  };

  const handleFontFamilyChange = (value: string) => {
    setFontFamily(value);
    saveSetting("fontFamily", value);
  };

  const handleCursorStyleChange = (value: string) => {
    setCursorStyle(value);
    saveSetting("cursorStyle", value);
  };

  const handleCursorBlinkChange = (value: boolean) => {
    setCursorBlink(value);
    saveSetting("cursorBlink", value.toString());
  };

  const handleScrollbackChange = (value: number) => {
    setScrollback(value);
    saveSetting("scrollback", value.toString());
  };

  const handleBellStyleChange = (value: string) => {
    setBellStyle(value);
    saveSetting("bellStyle", value);
  };

  const handleClearAllSessions = async () => {
    if (
      await confirmDelete(
        "Are you sure you want to close all active terminal sessions?",
      )
    ) {
      closeAllTabs();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Settings Navigation */}
      <div className="flex flex-col border-b border-dark-700">
        {settingsTabs.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`gap-2 px-4 py-2.5 rounded-none justify-start ${
              activeTab === tab.id
                ? "text-primary-500 bg-dark-800 border-l-2 border-primary-500"
                : "text-dark-400 hover:text-white"
            }`}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === "appearance" && (
          <AppearanceTab
            currentTheme={currentTheme}
            fontSize={fontSize}
            fontFamily={fontFamily}
            setTheme={setTheme}
            setFontSize={handleFontSizeChange}
            setFontFamily={handleFontFamilyChange}
          />
        )}
        {activeTab === "terminal" && (
          <TerminalTab
            cursorStyle={cursorStyle}
            cursorBlink={cursorBlink}
            scrollback={scrollback}
            bellStyle={bellStyle}
            setCursorStyle={handleCursorStyleChange}
            setCursorBlink={handleCursorBlinkChange}
            setScrollback={handleScrollbackChange}
            setBellStyle={handleBellStyleChange}
          />
        )}
        {activeTab === "ssh" && (
          <SshTab
            knownHosts={knownHosts}
            knownHostsLoading={knownHostsLoading}
            onLoadKnownHosts={loadKnownHosts}
            onRemoveKnownHost={handleRemoveKnownHost}
            onClearAllKnownHosts={handleClearAllKnownHosts}
          />
        )}
        {activeTab === "security" && (
          <SecurityTab
            tabs={tabs}
            onClearAllSessions={handleClearAllSessions}
          />
        )}
        {activeTab === "advanced" && (
          <AdvancedTab
            currentTheme={currentTheme}
            fontSize={fontSize}
            fontFamily={fontFamily}
            cursorStyle={cursorStyle}
            cursorBlink={cursorBlink}
            scrollback={scrollback}
            bellStyle={bellStyle}
            setTheme={setTheme}
            setFontSize={handleFontSizeChange}
            setFontFamily={handleFontFamilyChange}
            setCursorStyle={handleCursorStyleChange}
            setCursorBlink={handleCursorBlinkChange}
            setScrollback={handleScrollbackChange}
            setBellStyle={handleBellStyleChange}
          />
        )}
      </div>

      {/* Common footer */}
      <div className="pt-6 border-t border-dark-700 flex justify-end">
        <Button type="button" onClick={onClose} variant="ghost">
          Done
        </Button>
      </div>
    </div>
  );
}
