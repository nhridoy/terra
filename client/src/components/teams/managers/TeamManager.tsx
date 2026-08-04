import { UsersIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useModal } from "@/hooks/useModal";
import type { CreateTeamFormSchema } from "@/lib/schema/teams/createTeamFormSchema";
import type { InviteMemberFormSchema } from "@/lib/schema/teams/inviteMemberFormSchema";
import { useTeamStore } from "@/stores/teams/teamStore";
import ConfirmDeleteDialog from "@/components/ui/ConfirmDeleteDialog";
import { Button } from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import InviteMemberForm from "@/components/teams/forms/InviteMemberForm";
import TeamForm from "@/components/teams/forms/TeamForm";

export default function TeamManager() {
  const {
    teams,
    selectedTeam,
    fetchTeams,
    createTeam,
    deleteTeam,
    selectTeam,
    addMember,
    removeMember,
    updateMemberRole,
  } = useTeamStore();

  const createModal = useModal();
  const inviteModal = useModal();
  const deleteDialog = useModal();
  const [deleteMessage, setDeleteMessage] = useState("");
  const pendingDeleteAction = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleCreateTeam = async (data: CreateTeamFormSchema) => {
    await createTeam({
      name: data.name,
      description: data.description,
    });
    createModal.hide();
  };

  const handleInviteMember = async (data: InviteMemberFormSchema) => {
    if (selectedTeam) {
      await addMember(selectedTeam.id, data.email, data.role);
      inviteModal.hide();
    }
  };

  const requestDelete = (message: string, action: () => void) => {
    setDeleteMessage(message);
    pendingDeleteAction.current = action;
    deleteDialog.show();
  };

  const confirmDeleteAction = () => {
    deleteDialog.hide();
    const action = pendingDeleteAction.current;
    pendingDeleteAction.current = null;
    action?.();
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam) return;
    requestDelete("Remove this member?", () => removeMember(selectedTeam.id, userId));
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (selectedTeam) {
      await updateMemberRole(selectedTeam.id, userId, newRole);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-500/20 text-purple-400";
      case "admin":
        return "bg-blue-500/20 text-blue-400";
      default:
        return "bg-dark-600 text-dark-300";
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Teams</h2>
          <Button
            type="button"
            onClick={createModal.show}
            variant="default"
            size="sm"
          >
            + New Team
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-dark-700 overflow-y-auto">
          {teams.length === 0 ? (
            <div className="p-4 text-center text-dark-400">
              <p>No teams yet</p>
              <p className="text-sm mt-2">Create or join a team</p>
            </div>
          ) : (
            teams.map((team) => (
              <Button
                key={team.id}
                type="button"
                onClick={() => selectTeam(team)}
                variant="ghost"
                className={`p-3 cursor-pointer border-b border-dark-700 text-left w-full h-auto justify-start ${
                  selectedTeam?.id === team.id
                    ? "bg-primary-600/20 border-l-2 border-l-primary-500"
                    : "hover:bg-dark-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-dark-700 rounded-lg flex items-center justify-center">
                    <span className="text-white font-medium">
                      {team.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">
                      {team.name}
                    </div>
                    <div className="text-dark-400 text-sm">
                      {team.members?.length || 0} members
                    </div>
                  </div>
                </div>
              </Button>
            ))
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedTeam ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {selectedTeam.name}
                  </h3>
                  {selectedTeam.description && (
                    <p className="text-dark-400 mt-1">
                      {selectedTeam.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={inviteModal.show}
                    variant="default"
                    size="sm"
                  >
                    Invite Member
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (selectedTeam) {
                        requestDelete("Delete this team?", () => deleteTeam(selectedTeam.id));
                      }
                    }}
                    variant="destructive"
                    size="sm"
                  >
                    Delete Team
                  </Button>
                </div>
              </div>

              <div className="bg-dark-800 rounded-xl p-4">
                <h4 className="text-white font-medium mb-4">
                  Members ({selectedTeam.members?.length || 0})
                </h4>
                <div className="space-y-3">
                  {selectedTeam.members?.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-dark-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-dark-600 rounded-full flex items-center justify-center">
                          <span className="text-white">
                            {member.username?.charAt(0).toUpperCase() ||
                              member.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="text-white">
                            {member.username || member.email}
                          </div>
                          <div className="text-dark-400 text-sm">
                            {member.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${getRoleBadgeColor(member.role)}`}
                        >
                          {member.role}
                        </span>
                        {member.role !== "owner" && (
                          <div className="flex gap-1">
                            <Select
                              value={member.role}
                              onValueChange={(v) =>
                                handleRoleChange(member.userId, v)
                              }
                              options={[
                                { value: "member", label: "Member" },
                                { value: "admin", label: "Admin" },
                              ]}
                              className="w-28"
                            />
                            <Button
                              type="button"
                              onClick={() => handleRemoveMember(member.userId)}
                              variant="ghost"
                              size="icon-xs"
                              className="hover:text-red-500"
                            >
                              <XIcon className="w-4 h-4" weight="bold" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-dark-400">
              <div className="text-center">
                <UsersIcon
                  className="w-16 h-16 mx-auto mb-4 text-dark-600"
                  weight="bold"
                />
                <p>Select a team to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {createModal.open && (
        <TeamForm onSubmit={handleCreateTeam} onClose={createModal.hide} />
      )}

      {inviteModal.open && (
        <InviteMemberForm
          onSubmit={handleInviteMember}
          onClose={inviteModal.hide}
        />
      )}

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        message={deleteMessage}
        onConfirm={confirmDeleteAction}
        onCancel={() => {
          deleteDialog.hide();
          pendingDeleteAction.current = null;
        }}
      />
    </div>
  );
}
