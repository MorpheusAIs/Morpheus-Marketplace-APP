"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, CheckCircle } from "lucide-react";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { apiGet, apiPut } from "@/lib/api/apiService";
import { API_URLS } from "@/lib/api/config";
import { useNotification } from "@/lib/NotificationContext";
import { ChangeEmailModal } from "@/components/change-email-modal";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { DeleteAccountModal } from "@/components/delete-account-modal";

interface AutomationSettings {
  is_enabled: boolean;
  session_duration: number;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export default function AccountSettingsPage() {
  const { user, defaultApiKey, accessToken } = useCognitoAuth();
  const { success, error } = useNotification();
  const [localSessionDuration, setLocalSessionDuration] = useState(86400);
  const [localIsEnabled, setLocalIsEnabled] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings | null>(null);
  const [verifiedApiKey, setVerifiedApiKey] = useState<string | null>(null);
  const [apiKeyPrefix, setApiKeyPrefix] = useState<string>("");

  useEffect(() => {
    // Load verified API key from sessionStorage
    const storedApiKey = sessionStorage.getItem('verified_api_key');
    const storedPrefix = sessionStorage.getItem('verified_api_key_prefix');
    if (storedApiKey && storedPrefix) {
      setVerifiedApiKey(storedApiKey);
      setApiKeyPrefix(storedPrefix);
    } else if (defaultApiKey) {
      setApiKeyPrefix(defaultApiKey.key_prefix);
    }

    // Load automation settings
    if (accessToken) {
      loadAutomationSettings();
    }
  }, [accessToken, defaultApiKey]);

  useEffect(() => {
    if (automationSettings) {
      const isChanged =
        localSessionDuration !== automationSettings.session_duration ||
        localIsEnabled !== automationSettings.is_enabled;
      setHasUnsavedChanges(isChanged);
    }
  }, [localSessionDuration, localIsEnabled, automationSettings]);

  const loadAutomationSettings = async () => {
    if (!accessToken) return;

    try {
      const response = await apiGet<AutomationSettings>(
        API_URLS.automationSettings(),
        accessToken
      );

      if (response.data) {
        setAutomationSettings(response.data);
        setLocalSessionDuration(response.data.session_duration);
        setLocalIsEnabled(response.data.is_enabled);
      }
    } catch (err) {
      console.error('Error loading automation settings:', err);
    }
  };

  const handleSaveChanges = async () => {
    if (!accessToken) {
      error("Authentication Required", "Please sign in to save settings");
      return;
    }

    if (localSessionDuration <= 0) {
      error("Validation Error", "Session duration must be greater than 0");
      return;
    }

    try {
      const response = await apiPut<AutomationSettings>(
        API_URLS.automationSettings(),
        {
          is_enabled: localIsEnabled,
          session_duration: localSessionDuration,
        },
        accessToken
      );

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        setAutomationSettings(response.data);
        setLocalSessionDuration(response.data.session_duration);
        setLocalIsEnabled(response.data.is_enabled);
        setHasUnsavedChanges(false);
        success("Settings Saved", "Your automation settings have been updated successfully.");
      }
    } catch (err) {
      error("Save Failed", err instanceof Error ? err.message : "Failed to save settings");
    }
  };

  const handleCancel = () => {
    if (automationSettings) {
      setLocalSessionDuration(automationSettings.session_duration);
      setLocalIsEnabled(automationSettings.is_enabled);
      setHasUnsavedChanges(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="flex-1 overflow-y-auto p-8">
        <h1 className="text-4xl font-bold text-foreground">Account Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account preferences and settings
        </p>

        {/* Account Authentication */}
        <Card className="mt-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-card-foreground">
              Account Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Email */}
            <div className="flex items-center justify-between space-x-4 py-4 border-b border-border">
              <Label htmlFor="email" className="text-foreground">
                Email Address
              </Label>
              <span className="text-muted-foreground">{user?.email || "N/A"}</span>
              <Button
                variant="outline"
                size="sm"
                className="text-white border-white hover:bg-white hover:text-black"
                onClick={() => setIsEmailModalOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Change
              </Button>
            </div>

            {/* Password */}
            <div className="flex items-center justify-between space-x-4 py-4 border-b border-border">
              <Label htmlFor="password" className="text-foreground">
                Password
              </Label>
              <span className="text-muted-foreground">••••••••••</span>
              <Button
                variant="outline"
                size="sm"
                className="text-white border-white hover:bg-white hover:text-black"
                onClick={() => setIsPasswordModalOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Change
              </Button>
            </div>

            {/* Delete Account */}
            <div className="mt-8 p-4 bg-red-900/20 border border-red-500 rounded-md flex items-center justify-between">
              <div>
                <p className="font-semibold text-red-500">Delete Account</p>
                <p className="text-sm text-red-400">WARNING! This action can not be undone</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Automation Settings */}
        <Card className="mt-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-card-foreground">
              Automation Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* API Key */}
            <div className="py-4 border-b border-border">
              <Label className="text-foreground">Selected API Key:</Label>
              <span className="ml-2 font-mono text-sm text-foreground">
                {apiKeyPrefix || defaultApiKey?.key_prefix || "None"}...
              </span>
              {verifiedApiKey && (
                <>
                  <div className="flex items-center mt-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                    <span className="text-green-500 text-sm">Verified</span>
                  </div>
                  <div className="flex items-center mt-1">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-green-500 text-sm">
                      Ready for Chat and Test Functionality
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Session Duration */}
            <div className="mt-6 py-4 border-b border-border">
              <Label htmlFor="session-duration" className="text-foreground">
                Session Duration (seconds)
              </Label>
              <Input
                id="session-duration"
                type="number"
                value={localSessionDuration}
                onChange={(e) => setLocalSessionDuration(parseInt(e.target.value) || 0)}
                className="mt-2 bg-input border-border"
                min="1"
              />
              <p className="text-muted-foreground text-sm mt-1">
                How long authentication sessions last. Minimum is 1 second.
              </p>
            </div>

            {/* Enable Automation */}
            <div className="flex items-center justify-between mt-6 py-4">
              <Label htmlFor="enable-automation" className="text-foreground">
                Enable Automation?
              </Label>
              <Switch
                id="enable-automation"
                checked={localIsEnabled}
                onCheckedChange={setLocalIsEnabled}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end space-x-2 mt-8 pt-4 border-t border-border">
            <Button
              variant="outline"
              className="text-foreground border-border hover:bg-accent"
              onClick={handleCancel}
              disabled={!hasUnsavedChanges}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={handleSaveChanges}
              disabled={!hasUnsavedChanges}
            >
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </div>

      <ChangeEmailModal open={isEmailModalOpen} onOpenChangeAction={setIsEmailModalOpen} />
      <ChangePasswordModal open={isPasswordModalOpen} onOpenChangeAction={setIsPasswordModalOpen} />
      <DeleteAccountModal open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen} />
    </AuthenticatedLayout>
  );
}

