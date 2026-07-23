import { GearSixIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { type Theme, themes, useThemeStore } from "../../stores/themeStore";
import { Button } from "../ui/Button";
import Input from "../ui/Input";
import Modal from "../ui/Modal";
import Select from "../ui/Select";

export default function Settings() {
  const { currentTheme, setTheme } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"themes" | "terminal" | "about">(
    "themes",
  );
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) {
    return (
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        variant="secondary"
        size="icon"
        className="fixed bottom-4 left-4 rounded-full shadow-lg"
        title="Settings"
      >
        <GearSixIcon className="w-5 h-5" weight="bold" />
      </Button>
    );
  }

  const filteredThemes = (Object.keys(themes) as Theme[]).filter((theme) =>
    themes[theme].name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const themeCategories = {
    popular: ["dark", "light", "dracula", "nord", "monokai", "onedark"],
    "catppuccin-family": [
      "catppuccin",
      "tokyo-night",
      "rose-pine",
      "palenight",
    ],
    "solarized-family": ["solarized", "ayu-mirage", "material-ocean"],
    github: ["github-dark", "github-light"],
    "gruvbox-family": ["gruvbox"],
    colorful: ["cyberpunk", "neon", "neon-pink", "matrix", "hacker"],
    nature: ["forest", "ocean", "sunset", "arctic", "volcanic"],
    other: ["midnight", "retro", "pastel", "warm"],
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => setIsOpen(false)}
      title="Settings"
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col" style={{ height: "70vh" }}>
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-dark-700 p-4 shrink-0">
            <Button
              variant="ghost"
              onClick={() => setActiveTab("themes")}
              className={`w-full justify-start mb-2 ${
                activeTab === "themes"
                  ? "bg-primary-600 text-white"
                  : "text-dark-400"
              }`}
            >
              Themes
            </Button>
            <Button
              variant="ghost"
              onClick={() => setActiveTab("terminal")}
              className={`w-full justify-start mb-2 ${
                activeTab === "terminal"
                  ? "bg-primary-600 text-white"
                  : "text-dark-400"
              }`}
            >
              Terminal
            </Button>
            <Button
              variant="ghost"
              onClick={() => setActiveTab("about")}
              className={`w-full justify-start ${
                activeTab === "about"
                  ? "bg-primary-600 text-white"
                  : "text-dark-400"
              }`}
            >
              About
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "themes" && (
              <div>
                <h3 className="text-lg font-medium text-white mb-4">
                  Themes ({Object.keys(themes).length})
                </h3>

                {/* Search */}
                <Input
                  placeholder="Search themes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="py-2 mb-6"
                />

                {searchQuery ? (
                  <div className="grid grid-cols-3 gap-3">
                    {filteredThemes.map((theme) => (
                      <ThemeButton
                        key={theme}
                        theme={theme}
                        isSelected={currentTheme === theme}
                        onSelect={() => setTheme(theme)}
                      />
                    ))}
                  </div>
                ) : (
                  Object.entries(themeCategories).map(
                    ([category, themeList]) => (
                      <div key={category} className="mb-6">
                        <h4 className="text-dark-400 text-sm font-medium mb-3 uppercase tracking-wider">
                          {category.replace(/-/g, " ")}
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                          {themeList.map((theme) => (
                            <ThemeButton
                              key={theme}
                              theme={theme as Theme}
                              isSelected={currentTheme === theme}
                              onSelect={() => setTheme(theme as Theme)}
                            />
                          ))}
                        </div>
                      </div>
                    ),
                  )
                )}
              </div>
            )}

            {activeTab === "terminal" && (
              <div>
                <h3 className="text-lg font-medium text-white mb-4">
                  Terminal Settings
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                    <div>
                      <div className="text-white font-medium">Font Size</div>
                      <div className="text-dark-400 text-sm">
                        Terminal font size in pixels
                      </div>
                    </div>
                    <Select
                      value="14px"
                      options={[
                        { value: "12px", label: "12px" },
                        { value: "14px", label: "14px" },
                        { value: "16px", label: "16px" },
                        { value: "18px", label: "18px" },
                        { value: "20px", label: "20px" },
                        { value: "24px", label: "24px" },
                      ]}
                      className="w-32"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                    <div>
                      <div className="text-white font-medium">Font Family</div>
                      <div className="text-dark-400 text-sm">
                        Terminal font family
                      </div>
                    </div>
                    <Select
                      value="JetBrains Mono"
                      options={[
                        { value: "JetBrains Mono", label: "JetBrains Mono" },
                        { value: "Fira Code", label: "Fira Code" },
                        {
                          value: "Source Code Pro",
                          label: "Source Code Pro",
                        },
                        { value: "Cascadia Code", label: "Cascadia Code" },
                        { value: "monospace", label: "monospace" },
                      ]}
                      className="w-48"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                    <div>
                      <div className="text-white font-medium">Cursor Style</div>
                      <div className="text-dark-400 text-sm">
                        Terminal cursor appearance
                      </div>
                    </div>
                    <Select
                      value="Block"
                      options={[
                        { value: "Block", label: "Block" },
                        { value: "Underline", label: "Underline" },
                        { value: "Bar", label: "Bar" },
                      ]}
                      className="w-32"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                    <div>
                      <div className="text-white font-medium">Cursor Blink</div>
                      <div className="text-dark-400 text-sm">
                        Enable cursor blinking
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      aria-label="Cursor Blink"
                      defaultChecked
                      className="w-5 h-5 rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                    <div>
                      <div className="text-white font-medium">
                        Scrollback Lines
                      </div>
                      <div className="text-dark-400 text-sm">
                        Number of lines to keep in scrollback
                      </div>
                    </div>
                    <Select
                      value="5000"
                      options={[
                        { value: "1000", label: "1000" },
                        { value: "5000", label: "5000" },
                        { value: "10000", label: "10000" },
                        { value: "50000", label: "50000" },
                      ]}
                      className="w-32"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "about" && (
              <div>
                <h3 className="text-lg font-medium text-white mb-4">
                  About TermVault
                </h3>
                <div className="bg-dark-800 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center">
                      <span className="text-white font-bold text-2xl">TV</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white">
                        TermVault
                      </h4>
                      <p className="text-dark-400">v1.0.0</p>
                    </div>
                  </div>
                  <p className="text-dark-300 mb-4">
                    Open-source, self-hosted SSH client and infrastructure
                    management platform. A 1-to-1 replica of Termius with
                    identical encryption, but self-hosted and open-source.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-dark-400">License</span>
                      <span className="text-white">MIT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dark-400">Encryption</span>
                      <span className="text-white">
                        Libsodium (XSalsa20 + Poly1305)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dark-400">Authentication</span>
                      <span className="text-white">SRP6a + Argon2id</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-700 flex justify-end shrink-0">
          <Button type="button" onClick={() => setIsOpen(false)}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ThemeButton({
  theme,
  isSelected,
  onSelect,
}: {
  theme: Theme;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="secondary"
      onClick={onSelect}
      className={`p-3 h-auto justify-start ${
        isSelected
          ? "border-primary-500 bg-primary-500/10 border-2"
          : "border-dark-700"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border border-dark-600"
          style={{ backgroundColor: themes[theme].colors.background }}
        />
        <div className="min-w-0">
          <div className="text-white text-sm font-medium truncate">
            {themes[theme].name}
          </div>
          {isSelected && <div className="text-primary-400 text-xs">Active</div>}
        </div>
      </div>
    </Button>
  );
}
