import {
  CaretDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  ShieldIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useModal } from "../../hooks/useModal";
import { confirmDelete } from "../../lib/confirmDelete";
import { useVaultStore } from "../../stores/vaultStore";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import Input from "../ui/Input";
import VaultForm from "./VaultForm";

interface VaultItem {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
}

const VAULT_COLORS = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-orange-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
];

function colorFor(vault: Partial<VaultItem>, index: number): string {
  if (vault.isDefault) return "bg-amber-500";
  return VAULT_COLORS[index % VAULT_COLORS.length];
}

export function VaultSelector() {
  const { vaults, currentVaultId, switchVault } = useVaultStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const formModal = useModal();
  const [editingVault, setEditingVault] = useState<VaultItem | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentVault = vaults.find((v) => v.id === currentVaultId);

  const filtered = vaults.filter(
    (v) =>
      v.name.toLowerCase().includes(query.toLowerCase()) ||
      (v.description || "").toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openCreateModal = () => {
    setOpen(false);
    setEditingVault(null);
    formModal.show();
  };

  const openEditModal = (vault: VaultItem) => {
    setOpen(false);
    setEditingVault(vault);
    formModal.show();
  };

  const handleDelete = async (vault: VaultItem) => {
    if (vault.isSystem) return;
    if (
      !(await confirmDelete(
        `Delete vault "${vault.name}"? All hosts, keys, groups, snippets, and history in this vault will be permanently removed.`,
      ))
    ) {
      return;
    }
    try {
      const { fetchVaults } = useVaultStore.getState();
      fetchVaults();
    } catch (e) {
      console.error("Failed to delete vault:", e);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        className="h-8 pl-2.5 pr-2 rounded-lg bg-dark-800 hover:bg-dark-700 hover:border-dark-600"
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${colorFor(
            currentVault || {},
            vaults.findIndex((v) => v.id === currentVaultId),
          )}`}
        />
        <span className="text-sm font-medium text-white truncate max-w-[140px]">
          {currentVault?.name || "Vault"}
        </span>
        <CaretDownIcon
          className={`w-3.5 h-3.5 text-dark-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </Button>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 z-50 rounded-xl bg-dark-900 border border-dark-700 shadow-2xl overflow-hidden animate-[fadeIn_120ms_ease-out]">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-800">
            <MagnifyingGlassIcon className="w-4 h-4 text-dark-400" />
            <span className="text-sm font-semibold text-white">Vaults</span>
            <span className="ml-auto text-xs text-dark-500">
              {vaults.length}
            </span>
          </div>

          {/* Search */}
          {vaults.length > 3 && (
            <div className="px-3 py-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vaults..."
                className="px-3 py-1.5 text-sm"
              />
            </div>
          )}

          {/* List */}
          <div className="max-h-72 overflow-y-auto scrollbar-none py-1 px-2">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-dark-500">
                No vaults found
              </div>
            )}
            {filtered.map((vault, i) => {
              const active = currentVaultId === vault.id;
              return (
                <div key={vault.id} className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      switchVault(vault.id);
                      setOpen(false);
                    }}
                    className={`group w-full px-2.5 py-2 justify-start rounded-lg ${
                      active ? "bg-primary-600/15" : ""
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorFor(vault, i)}`}
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium truncate ${active ? "text-primary-300" : "text-white"}`}
                        >
                          {vault.name}
                        </span>
                        {vault.isDefault && (
                          <Badge variant="amber">Default</Badge>
                        )}
                        {vault.isSystem && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dark-400 bg-white/5 rounded">
                            <ShieldIcon className="w-2.5 h-2.5" weight="fill" />
                            Protected
                          </span>
                        )}
                      </div>
                      {vault.description && (
                        <p className="text-xs text-dark-500 truncate mt-0.5">
                          {vault.description}
                        </p>
                      )}
                    </div>
                    {vault.isSystem ? (
                      <span className="w-4 shrink-0" />
                    ) : (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {active && (
                          <CheckIcon
                            className="w-4 h-4 text-primary-400 group-hover:hidden"
                            weight="bold"
                          />
                        )}
                        <div className="hidden group-hover:flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(vault);
                            }}
                            className="hover:bg-white/10 rounded"
                            title="Edit vault"
                          >
                            <PencilSimpleIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(vault);
                            }}
                            className="hover:text-red-400 hover:bg-red-500/10 rounded"
                            title="Delete vault"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-dark-800">
            <Button
              type="button"
              variant="ghost"
              onClick={openCreateModal}
              className="w-full py-2 text-primary-400 hover:text-primary-300 hover:bg-primary-600/10 rounded-lg justify-start"
            >
              <PlusIcon className="w-4 h-4" />
              Create vault
            </Button>
          </div>
        </div>
      )}

      {formModal.open && (
        <VaultForm
          vault={editingVault ? { id: editingVault.id, name: editingVault.name, description: editingVault.description } : undefined}
          onClose={() => {
            formModal.hide();
            setEditingVault(null);
          }}
        />
      )}
    </div>
  );
}

export default VaultSelector;
