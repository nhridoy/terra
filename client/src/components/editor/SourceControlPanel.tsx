import { GitBranchIcon } from "@phosphor-icons/react";

export default function SourceControlPanel() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-dark-900 border-r border-dark-800 px-4 text-center">
      <GitBranchIcon className="w-8 h-8 mb-2 text-dark-600" weight="bold" />
      <p className="text-xs text-dark-400">
        Source control arrives in a later phase
      </p>
    </div>
  );
}
