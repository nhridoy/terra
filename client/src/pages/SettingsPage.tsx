import { useNavigate } from "react-router";
import SettingsPanel from "../components/settings/SettingsPanel";

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto">
      <SettingsPanel onClose={() => navigate(-1)} />
    </div>
  );
}
