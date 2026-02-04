"use client";

import { useState, useEffect } from "react";
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
  UpdateUserAttributesCommand,
  VerifyUserAttributeCommand,
  GetUserCommand 
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
  onOpenChangeAction: (open: boolean) => void;
}

type Step = "enter-email" | "verify-code";

export function ChangeEmailModal({ open, onOpenChangeAction }: ChangeEmailModalProps) {
  const { user, accessToken, refreshUserAttributes } = useCognitoAuth();
  const { success, error } = useNotification();
  const [newEmail, setNewEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<Step>("enter-email");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Reset state when modal is closed
  useEffect(() => {
    if (!open) {
      setNewEmail("");
      setVerificationCode("");
      setStep("enter-email");
      setErrorMessage("");
    }
  }, [open]);

  const handleRequestEmailChange = async () => {
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
      
      // Move to verification step
      setStep("verify-code");
      success("Verification Code Sent", "Please check your new email for the 6-digit verification code.");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to change email";
      setErrorMessage(errorMsg);
      error("Email Change Failed", errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setErrorMessage("Please enter the verification code");
      return;
    }

    if (verificationCode.length !== 6) {
      setErrorMessage("Verification code must be 6 digits");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      // Verify the email with the code
      const verifyCommand = new VerifyUserAttributeCommand({
        AccessToken: accessToken || "",
        AttributeName: "email",
        Code: verificationCode,
      });

      await getCognitoClient().send(verifyCommand);

      // Verify the email was actually updated by fetching user attributes
      const getUserCommand = new GetUserCommand({
        AccessToken: accessToken || "",
      });
      
      const userResponse = await getCognitoClient().send(getUserCommand);
      const emailAttribute = userResponse.UserAttributes?.find(attr => attr.Name === "email");
      
      if (emailAttribute?.Value === newEmail) {
        // Refresh user attributes in the auth context to update the UI
        await refreshUserAttributes();
        
        success("Email Changed Successfully", "Your email address has been updated.");
        onOpenChangeAction(false);
      } else {
        throw new Error("Email verification succeeded but email was not updated");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to verify code";
      setErrorMessage(errorMsg);
      error("Verification Failed", errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (step === "verify-code") {
      // If we're on the verification step, go back to email entry
      setStep("enter-email");
      setVerificationCode("");
      setErrorMessage("");
    } else {
      // Otherwise close the modal
      onOpenChangeAction(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {step === "enter-email" ? "Change Email" : "Verify New Email"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {step === "enter-email"
              ? "Enter your new email address. You will need to verify it with a code."
              : `Enter the 6-digit code sent to ${newEmail}`}
          </DialogDescription>
        </DialogHeader>
        
        {step === "enter-email" ? (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-email" className="text-right col-span-4 sm:col-span-1">
                New Email
              </Label>
              <div className="col-span-4 sm:col-span-3">
                <Input
                  id="new-email"
                  type="email"
                  placeholder="new.email@example.com"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setErrorMessage("");
                  }}
                  className="col-span-4 sm:col-span-3"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRequestEmailChange();
                    }
                  }}
                />
                {errorMessage && <p className="text-sm text-red-500 mt-1">{errorMessage}</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="verification-code" className="text-right col-span-4 sm:col-span-1">
                Code
              </Label>
              <div className="col-span-4 sm:col-span-3">
                <Input
                  id="verification-code"
                  type="text"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => {
                    // Only allow digits and limit to 6 characters
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setVerificationCode(value);
                    setErrorMessage("");
                  }}
                  className="text-center text-lg tracking-widest"
                  maxLength={6}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleVerifyCode();
                    }
                  }}
                />
                {errorMessage && <p className="text-sm text-red-500 mt-1">{errorMessage}</p>}
                <p className="text-xs text-muted-foreground mt-2">
                  Check your new email inbox for the verification code
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            {step === "verify-code" ? "Back" : "Cancel"}
          </Button>
          <Button
            type="submit"
            className="bg-[#FD67C4] hover:bg-[#FD67C4]/90 text-white"
            onClick={step === "enter-email" ? handleRequestEmailChange : handleVerifyCode}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : step === "enter-email" ? "Send Code" : "Verify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

