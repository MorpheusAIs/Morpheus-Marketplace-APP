"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { useNotification } from "@/lib/NotificationContext";
import {
  ChangePasswordCommand,
  UpdateUserAttributesCommand,
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

interface ChangeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeEmailModal({ open, onOpenChange }: ChangeEmailModalProps) {
  const { user, accessToken } = useCognitoAuth();
  const { success, error } = useNotification();
  const [newEmail, setNewEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async () => {
    if (!newEmail.trim()) {
      setErrorMessage("Please enter a new email address");
      return;
    }

    if (newEmail === user?.email) {
      setErrorMessage("New email must be different from current email");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setErrorMessage("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      // Use Cognito SDK to update email
      // Note: This requires the user to verify the new email
      const command = new UpdateUserAttributesCommand({
        AccessToken: accessToken || "",
        UserAttributes: [
          {
            Name: "email",
            Value: newEmail,
          },
        ],
      });

      await getCognitoClient().send(command);
      
      success("Email Change Initiated", "Please check your new email to confirm the change.");
      setNewEmail("");
      onOpenChange(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to change email";
      setErrorMessage(errorMsg);
      error("Email Change Failed", errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Change Email</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            You will need to confirm your new email address before the change is final.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="new-email" className="text-right col-span-4 sm:col-span-1">
              New Email Address
            </Label>
            <div className="col-span-4 sm:col-span-3">
              <Input
                id="new-email"
                type="email"
                placeholder="New Email Address"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setErrorMessage("");
                }}
                className="col-span-4 sm:col-span-3"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit();
                  }
                }}
              />
              {errorMessage && <p className="text-sm text-red-500 mt-1">{errorMessage}</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-[#FD67C4] hover:bg-[#FD67C4]/90 text-white"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Changing..." : "Change Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

