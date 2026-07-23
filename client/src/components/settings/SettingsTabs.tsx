import {
  EyeIcon,
  GearSixIcon,
  LightningIcon,
  PaletteIcon,
  ShieldCheckIcon,
  TerminalWindowIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

interface SettingsTab {
  id: string;
  label: string;
  icon: ReactNode;
}

const settingsTabs: SettingsTab[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: <PaletteIcon className="w-5 h-5" />,
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: <TerminalWindowIcon className="w-5 h-5" />,
  },
  {
    id: "ssh",
    label: "SSH",
    icon: <LightningIcon className="w-5 h-5" />,
  },
  {
    id: "security",
    label: "Security",
    icon: <ShieldCheckIcon className="w-5 h-5" />,
  },
  {
    id: "advanced",
    label: "Advanced",
    icon: (
      <>
        <GearSixIcon className="w-5 h-5" />
        <EyeIcon className="w-5 h-5" weight="bold" />
      </>
    ),
  },
];

export default settingsTabs;
