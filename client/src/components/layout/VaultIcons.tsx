import {
  CaretDown,
  Check,
  ClockCounterClockwise,
  FileText,
  Folder,
  GearSix,
  Key,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  X,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'

const ICONS: Record<string, ReactNode> = {
  vault: <MagnifyingGlass className="w-5 h-5" />,
  chevronDown: <CaretDown className="w-4 h-4" />,
  edit: <PencilSimple className="w-4 h-4" />,
  deleteIcon: <Trash className="w-4 h-4" />,
  plus: <Plus className="w-4 h-4" />,
  close: <X className="w-4 h-4" />,
  check: <Check className="w-5 h-5" weight="bold" />,
  search: <MagnifyingGlass className="w-5 h-5" />,
  folder: <Folder className="w-5 h-5" weight="bold" />,
  key: <Key className="w-5 h-5" weight="bold" />,
  snippet: <FileText className="w-5 h-5" weight="bold" />,
  keyIcon: <Key className="w-5 h-5" weight="bold" />,
  history: <ClockCounterClockwise className="w-5 h-5" weight="bold" />,
  settings: <GearSix className="w-5 h-5" weight="bold" />,
  newVault: <Plus className="w-4 h-4" />,
}

export default ICONS
