import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Trash2, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useCrowth } from "../context/CrowthContext";
import {
  deleteUserAccount,
  updateUserDisplayName,
} from "../services/supabaseDb";
import { isSupabaseConfigured } from "../../lib/supabase";

function displayNameFromUser(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata ?? {};
  return (
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.display_name === "string" && meta.display_name) ||
    ""
  );
}

type ProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const navigate = useNavigate();
  const { user, signOut, showToast } = useCrowth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(displayNameFromUser(user));
      setError("");
      setConfirmDelete(false);
    }
  }, [open, user]);

  const email = user?.email ?? "Not signed in";
  const initial =
    (name.trim() || email).charAt(0).toUpperCase() || "?";

  const handleSave = async () => {
    setError("");
    if (!isSupabaseConfigured || !user) {
      setError("Sign in to edit your profile.");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a display name.");
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await updateUserDisplayName(trimmed);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      showToast("Profile updated");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setError("");
    if (!isSupabaseConfigured || !user) {
      setError("Sign in to delete your profile.");
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const { error: deleteError } = await deleteUserAccount();
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
      await signOut();
      showToast("Account deleted");
      onOpenChange(false);
      navigate("/auth", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete account.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-0 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#0A1F44]">Your profile</DialogTitle>
          <DialogDescription className="text-[#0A1F44]/80">
            Update how you appear in Crowth, or permanently delete your
            account.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <div className="w-16 h-16 rounded-full bg-[#0A1F44] text-white flex items-center justify-center text-2xl font-bold">
            {initial}
          </div>
          <p className="text-sm font-medium text-[#0A1F44] break-all text-center">
            {email}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-name" className="text-[#0A1F44]">
            Display name
          </Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={80}
            className="h-12 rounded-2xl bg-[#F5F7FA] border-0 text-[#0A1F44]"
            disabled={saving || deleting || !user}
          />
        </div>

        {error && (
          <p className="text-sm font-medium text-[#C62828]">{error}</p>
        )}

        {confirmDelete && (
          <div className="rounded-2xl bg-[#E03A3E]/10 p-3 text-sm text-[#C62828]">
            This permanently deletes your Crowth account and demo portfolios.
            Tap Delete again to confirm.
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting || !user}
            className="w-full h-12 rounded-2xl bg-[#0A1F44] hover:bg-[#0A1F44]/90 text-white"
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            disabled={saving || deleting || !user}
            className="w-full h-12 rounded-2xl border-[#E03A3E]/40 text-[#C62828] hover:bg-[#E03A3E]/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleting
              ? "Deleting..."
              : confirmDelete
                ? "Confirm delete account"
                : "Delete account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProfileMenuButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="touch-target w-10 h-10 shrink-0 rounded-2xl bg-[#F5F7FA] flex items-center justify-center"
      aria-label="Open profile"
    >
      <UserRound className="w-5 h-5 text-[#0A1F44]" />
    </button>
  );
}
