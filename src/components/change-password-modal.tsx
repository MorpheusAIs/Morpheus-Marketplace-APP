"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { useNotification } from "@/lib/NotificationContext";
import {
  ChangePasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { cognitoConfig } from "@/lib/auth/cognito-config";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

// Lazy initialization of Cognito client to avoid build-time errors
let cognitoClient: CognitoIdentityProviderClient | null = null;

function getCognitoClient(): CognitoIdentityProviderClient {
  if (!cognitoClient) {
    cognitoClient = new CognitoIdentityProviderClient({
      region: cognitoConfig.region,
    });
  }
  return cognitoClient;
}

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

export function ChangePasswordModal({ open, onOpenChangeAction }: ChangePasswordModalProps) {
  const { accessToken } = useCognitoAuth();
  const { success, error } = useNotification();
  const [previousPassword, setPreviousPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPreviousPassword, setShowPreviousPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async () => {
    if (!previousPassword || !newPassword || !confirmPassword) {
      setErrorMessage("All fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New passwords do not match");
      return;
    }

    if (newPassword.length < 15) {
      setErrorMessage("New password must be at least 15 characters long");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const command = new ChangePasswordCommand({
        AccessToken: accessToken || "",
        PreviousPassword: previousPassword,
        ProposedPassword: newPassword,
      });

      await getCognitoClient().send(command);
      
      success("Password Changed", "Your password has been changed successfully.");
      setPreviousPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChangeAction(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to change password";
      setErrorMessage(errorMsg);
      error("Password Change Failed", errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="w-full max-w-md p-6 bg-card text-card-foreground rounded-lg shadow-lg border-none">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-bold text-foreground">
            Change Password
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Enter your current password to switch to a new password
          </DialogDescription>
        </DialogHeader>
        <form className="mt-6 space-y-5" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          {/* Previous Password */}
          <div className="space-y-2">
            <Label htmlFor="previous-password">Previous Password</Label>
            <div className="relative">
              <Input
                id="previous-password"
                type={showPreviousPassword ? "text" : "password"}
                placeholder="Enter password"
                value={previousPassword}
                onChange={(e) => {
                  setPreviousPassword(e.target.value);
                  setErrorMessage("");
                }}
                autoComplete="current-password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:bg-transparent"
                onClick={() => setShowPreviousPassword(!showPreviousPassword)}
              >
                {showPreviousPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setErrorMessage("");
                }}
                autoComplete="new-password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:bg-transparent"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-new-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrorMessage("");
                }}
                autoComplete="new-password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="px-6 py-2"
              onClick={() => onOpenChangeAction(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2"
              disabled={isLoading}
            >
              {isLoading ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

