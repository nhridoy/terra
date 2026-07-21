import {
  Eye,
  GearSix,
  Lightning,
  Palette,
  ShieldCheck,
  TerminalWindow,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'

interface SettingsTab {
  id: string
  label: string
  icon: ReactNode
}

const settingsTabs: SettingsTab[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    icon: <Palette className="w-5 h-5" />,
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: <TerminalWindow className="w-5 h-5" />,
  },
  {
    id: 'ssh',
    label: 'SSH',
    icon: <Lightning className="w-5 h-5" />,
  },
  {
    id: 'security',
    label: 'Security',
    icon: <ShieldCheck className="w-5 h-5" />,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: (
      <>
        <GearSix className="w-5 h-5" />
        <Eye className="w-5 h-5" weight="bold" />
      </>
    ),
  },
]

export default settingsTabs
