interface SharedVaultManagerProps {
  teamId: string;
}

export default function SharedVaultManager({
  teamId: _teamId,
}: SharedVaultManagerProps) {
  return (
    <div className="p-6 text-center text-dark-400">
      <p>Shared vaults are not available in sync-only mode.</p>
    </div>
  );
}
