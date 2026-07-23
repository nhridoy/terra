import {
  CaretDownIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  FileTextIcon,
  FolderIcon,
  GearSixIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  vault: <MagnifyingGlassIcon className="w-5 h-5" />,
  chevronDown: <CaretDownIcon className="w-4 h-4" />,
  edit: <PencilSimpleIcon className="w-4 h-4" />,
  deleteIcon: <TrashIcon className="w-4 h-4" />,
  plus: <PlusIcon className="w-4 h-4" />,
  close: <XIcon className="w-4 h-4" />,
  check: <CheckIcon className="w-5 h-5" weight="bold" />,
  search: <MagnifyingGlassIcon className="w-5 h-5" />,
  folder: <FolderIcon className="w-5 h-5" weight="bold" />,
  key: <KeyIcon className="w-5 h-5" weight="bold" />,
  snippet: <FileTextIcon className="w-5 h-5" weight="bold" />,
  keyIcon: <KeyIcon className="w-5 h-5" weight="bold" />,
  history: <ClockCounterClockwiseIcon className="w-5 h-5" weight="bold" />,
  settings: <GearSixIcon className="w-5 h-5" weight="bold" />,
  newVault: <PlusIcon className="w-4 h-4" />,
};

export default ICONS;
