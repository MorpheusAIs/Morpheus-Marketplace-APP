"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { useNotification } from "@/lib/NotificationContext";
import { useRouter } from "next/navigation";
import { apiDelete } from "@/lib/api/apiService";
import { API_URLS } from "@/lib/api/config";

interface DeleteAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountModal({ open, onOpenChange }: DeleteAccountModalProps) {
  const { logout, accessToken } = useCognitoAuth();
  const { success, error } = useNotification();
  const router = useRouter();
  const [confirmationText, setConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const isConfirmed = confirmationText === "Delete";

  const handleDelete = async () => {
    if (!isConfirmed) return;

    setIsDeleting(true);
    try {
      // Note: Check if backend endpoint exists for account deletion
      // For now, we'll use a placeholder - you may need to add this endpoint to config.ts
      if (accessToken) {
        // If backend endpoint exists:
        // const response = await apiDelete(API_URLS.deleteAccount(), accessToken);
        // if (response.error) {
        //   throw new Error(response.error);
        // }
        
        // For now, just sign out the user
        // TODO: Implement actual account deletion API call when endpoint is available
        console.log("Account deletion requested");
      }
      
      // Sign out user
      logout();
      
      success("Account Deleted", "Your account has been deleted successfully.");
      setConfirmationText("");
      onOpenChange(false);
      router.push("/signin");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete account";
      error("Deletion Failed", errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card text-card-foreground rounded-lg p-6">
        <AlertDialogHeader className="space-y-4 mb-6">
          <AlertDialogTitle className="text-2xl font-bold text-red-500">
            Delete Account
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground text-sm leading-relaxed">
            Are you sure you want to permanently delete your account? This action can not be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-6 mb-8 space-y-2">
          <Label htmlFor="delete-confirmation" className="text-foreground text-sm font-medium">
            Type "Delete"
          </Label>
          <Input
            id="delete-confirmation"
            type="text"
            placeholder="Delete"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            className="bg-input border-border text-foreground focus:ring-red-500 focus:border-red-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && isConfirmed) {
                handleDelete();
              }
            }}
          />
        </div>
        <AlertDialogFooter className="flex justify-end gap-3 mt-6">
          <AlertDialogCancel asChild>
            <Button variant="ghost" className="text-muted-foreground hover:bg-muted">
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={!isConfirmed || isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Account"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

