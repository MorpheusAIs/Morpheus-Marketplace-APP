"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Copy, Check } from "lucide-react";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { useNotification } from "@/lib/NotificationContext";
import { ChangeEmailModal } from "@/components/change-email-modal";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { DeleteAccountModal } from "@/components/delete-account-modal";

export default function AccountSettingsPage() {
  const { user } = useCognitoAuth();
  const { success, error } = useNotification();
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [accountIdCopied, setAccountIdCopied] = useState(false);

  const handleCopyAccountId = async () => {
    if (user?.sub) {
      try {
        await navigator.clipboard.writeText(user.sub);
        setAccountIdCopied(true);
        success("Copied!", "Account ID copied to clipboard");
        setTimeout(() => setAccountIdCopied(false), 2000);
      } catch (err) {
        error("Copy Failed", "Failed to copy account ID to clipboard");
      }
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <h1 className="text-2xl md:text-4xl font-bold text-foreground">Account Settings</h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          Manage your account preferences and settings
        </p>

        {/* Account Details */}
        <Card className="mt-4 md:mt-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl font-semibold text-card-foreground">
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Account ID */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 py-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <Label htmlFor="account-id" className="text-foreground block mb-1 md:mb-0">
                  Account ID
                </Label>
                <span className="text-muted-foreground text-sm md:text-base break-all md:break-normal font-mono">
                  {user?.sub || "N/A"}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-white border-white hover:bg-white hover:text-black w-full md:w-auto shrink-0"
                onClick={handleCopyAccountId}
                disabled={!user?.sub}
              >
                {accountIdCopied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            {/* Email */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 py-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <Label htmlFor="email" className="text-foreground block mb-1 md:mb-0">
                  Email Address
                </Label>
                <span className="text-muted-foreground text-sm md:text-base break-all md:break-normal">{user?.email || "N/A"}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-white border-white hover:bg-white hover:text-black w-full md:w-auto shrink-0"
                onClick={() => setIsEmailModalOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Change
              </Button>
            </div>

            {/* Password */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 py-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <Label htmlFor="password" className="text-foreground block mb-1 md:mb-0">
                  Password
                </Label>
                <span className="text-muted-foreground text-sm md:text-base">••••••••••</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-white border-white hover:bg-white hover:text-black w-full md:w-auto shrink-0"
                onClick={() => setIsPasswordModalOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Change
              </Button>
            </div>

            {/* Delete Account */}
            <div className="mt-4 md:mt-8 p-4 bg-red-900/20 border border-red-500 rounded-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-red-500 text-sm md:text-base">Delete Account</p>
                <p className="text-xs md:text-sm text-red-400 mt-1">WARNING! This action can not be undone</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full md:w-auto shrink-0"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ChangeEmailModal open={isEmailModalOpen} onOpenChangeAction={setIsEmailModalOpen} />
      <ChangePasswordModal open={isPasswordModalOpen} onOpenChangeAction={setIsPasswordModalOpen} />
      <DeleteAccountModal open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen} />
    </AuthenticatedLayout>
  );
}

