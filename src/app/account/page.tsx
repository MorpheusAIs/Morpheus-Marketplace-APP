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
    if (automationSettings !== null) {
      const sessionDurationChanged = Number(localSessionDuration) !== Number(automationSettings.session_duration);
      // Handle null values - default to true per OpenAPI spec
      const currentEnabled = localIsEnabled ?? true;
      const savedEnabled = automationSettings.is_enabled ?? true;
      const isEnabledChanged = Boolean(currentEnabled) !== Boolean(savedEnabled);
      const isChanged = sessionDurationChanged || isEnabledChanged;
      setHasUnsavedChanges(isChanged);
    } else {
      // If automationSettings hasn't loaded yet, don't enable save button
      setHasUnsavedChanges(false);
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
        setLocalSessionDuration(response.data.session_duration ?? 3600);
        // Handle null values - default to true per OpenAPI spec
        setLocalIsEnabled(response.data.is_enabled ?? true);
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
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <h1 className="text-2xl md:text-4xl font-bold text-foreground">Account Settings</h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          Manage your account preferences and settings
        </p>

        {/* Account Authentication */}
        <Card className="mt-4 md:mt-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl font-semibold text-card-foreground">
              Account Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
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

        {/* Automation Settings */}
        <Card className="mt-4 md:mt-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl font-semibold text-card-foreground">
              Automation Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* API Key */}
            <div className="py-4 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <Label className="text-foreground text-sm md:text-base">Selected API Key:</Label>
                <span className="font-mono text-xs sm:text-sm text-foreground break-all">
                  {apiKeyPrefix || defaultApiKey?.key_prefix || "None"}...
                </span>
              </div>
              {verifiedApiKey && (
                <>
                  <div className="flex items-center mt-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 mr-2 shrink-0"></div>
                    <span className="text-green-500 text-xs md:text-sm">Verified</span>
                  </div>
                  <div className="flex items-center mt-1">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2 shrink-0" />
                    <span className="text-green-500 text-xs md:text-sm">
                      Ready for Chat and Test Functionality
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Session Duration and Enable Automation */}
            <div className="flex flex-col md:flex-row gap-4 md:gap-6 mt-4 md:mt-6 py-4 border-b border-border">
              {/* Session Duration */}
              <div className="flex-1">
                <Label htmlFor="session-duration" className="text-foreground text-sm md:text-base">
                  Session Duration (seconds)
                </Label>
                <Input
                  id="session-duration"
                  type="number"
                  value={localSessionDuration}
                  onChange={(e) => setLocalSessionDuration(parseInt(e.target.value) || 0)}
                  className="mt-2 bg-input border-border text-sm md:text-base"
                  min="1"
                />
                <p className="text-muted-foreground text-xs md:text-sm mt-1">
                  How long authentication sessions last. Minimum is 1 second.
                </p>
              </div>

              {/* Vertical Separator - Desktop Only */}
              <div className="hidden md:block border-r border-border"></div>

              {/* Enable Automation */}
              <div className="flex items-center justify-between md:flex-col md:items-start md:justify-start flex-1">
                <Label htmlFor="enable-automation" className="text-foreground text-sm md:text-base mb-0 md:mb-2">
                  Enable Automation?
                </Label>
                <Switch
                  id="enable-automation"
                  checked={localIsEnabled}
                  onCheckedChange={setLocalIsEnabled}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end sm:space-x-2 mt-4 md:mt-8 pt-4 border-t border-border">
            <Button
              variant="outline"
              className="text-foreground border-border hover:bg-accent w-full sm:w-auto"
              onClick={handleCancel}
              disabled={!hasUnsavedChanges}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-500 hover:bg-green-600 text-white w-full sm:w-auto"
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

