import { useState } from "react";
import { useModal } from "../hooks/useModal";
import SnippetForm from "../components/snippets/SnippetForm";
import SnippetList, {
  type Snippet,
} from "../components/snippets/SnippetList";

export default function SnippetsPage() {
  const formModal = useModal();
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <SnippetList
        onNew={() => {
          setEditingSnippet(null);
          formModal.show();
        }}
        onEdit={(snippet) => {
          setEditingSnippet(snippet);
          formModal.show();
        }}
      />

      {formModal.open && (
        <SnippetForm
          snippet={editingSnippet ?? undefined}
          onClose={() => {
            formModal.hide();
            setEditingSnippet(null);
          }}
        />
      )}
    </div>
  );
}
