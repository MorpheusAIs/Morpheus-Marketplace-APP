"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, Trash2, Plus } from "lucide-react";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { apiPost, apiPut, apiDelete } from "@/lib/api/apiService";
import { API_URLS } from "@/lib/api/config";
import { useNotification } from "@/lib/NotificationContext";
import { CreateApiKeyDialog } from "@/components/create-api-key-dialog";
import { NewApiKeyModal } from "@/components/new-api-key-modal";
import { VerifyApiKeyModal } from "@/components/verify-api-key-modal";

interface ApiKey {
  id: number;
  key_prefix: string;
  name: string;
  created_at: string;
  is_active: boolean;
  is_default: boolean;
}

interface ApiKeyResponse {
  key: string;
  key_prefix: string;
  name: string;
}

export default function ApiKeysPage() {
  const { apiKeys, defaultApiKey, accessToken, refreshApiKeys } = useCognitoAuth();
  const { success, error } = useNotification();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [selectedKeyPrefix, setSelectedKeyPrefix] = useState<string>("");
  const [verifiedKeyPrefix, setVerifiedKeyPrefix] = useState<string | null>(null);

  // Check for verified API key in sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const verifiedPrefix = sessionStorage.getItem('verified_api_key_prefix');
      setVerifiedKeyPrefix(verifiedPrefix);
    }
  }, [apiKeys]);

  const handleCreateKey = async (name: string) => {
    if (!accessToken) {
      error("Authentication Required", "Please sign in to create API keys");
      return;
    }

    try {
      const response = await apiPost<ApiKeyResponse>(
        API_URLS.keys(),
        { name },
        accessToken
      );

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data && response.data.key) {
        setNewlyCreatedKey(response.data.key);
        setIsCreateDialogOpen(false);
        setIsNewKeyModalOpen(true);
        await refreshApiKeys();
        success("API Key Created", `Your API key "${name}" has been created successfully.`);
      }
    } catch (err) {
      error("Failed to Create API Key", err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleSetDefault = async (keyId: number) => {
    if (!accessToken) {
      error("Authentication Required", "Please sign in to set default key");
      return;
    }

    try {
      const response = await apiPut(API_URLS.setDefaultKey(keyId), {}, accessToken);
      if (response.error) {
        throw new Error(response.error);
      }
      await refreshApiKeys();
      success("Default Key Updated", "Your default API key has been updated.");
    } catch (err) {
      error("Failed to Set Default", err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleDelete = async (keyId: number, keyName: string) => {
    if (!accessToken) {
      error("Authentication Required", "Please sign in to delete keys");
      return;
    }

    try {
      const response = await apiDelete(API_URLS.deleteKey(keyId), accessToken);
      if (response.error) {
        throw new Error(response.error);
      }
      await refreshApiKeys();
      success("API Key Deleted", `The API key "${keyName}" has been deleted.`);
    } catch (err) {
      error("Failed to Delete Key", err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleSelect = (keyPrefix: string) => {
    setSelectedKeyPrefix(keyPrefix);
    setIsVerifyModalOpen(true);
  };

  const handleVerifySuccess = () => {
    setIsVerifyModalOpen(false);
    const verifiedPrefix = selectedKeyPrefix;
    setSelectedKeyPrefix("");
    setVerifiedKeyPrefix(verifiedPrefix);
    success("API Key Verified", "Your API key has been verified. You can now use Chat and Test features.");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const isKeySelected = (keyPrefix: string) => {
    return verifiedKeyPrefix === keyPrefix;
  };

  return (
    <AuthenticatedLayout>
      <div className="flex-1 overflow-y-auto p-8">
        <h1 className="text-4xl font-bold text-foreground">API Keys</h1>
        <p className="text-lg text-muted-foreground mt-2">Manage your Morpheus API keys.</p>

        <div className="bg-card p-6 rounded-lg mt-8 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-foreground">My API Keys</h2>
            <Button
              variant="ghost"
              className="text-green-500 hover:bg-muted"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Key
            </Button>
          </div>
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="text-left text-muted-foreground font-medium">Name</TableHead>
                <TableHead className="text-left text-muted-foreground font-medium">API Key</TableHead>
                <TableHead className="text-left text-muted-foreground font-medium">Last Used</TableHead>
                <TableHead className="text-left text-muted-foreground font-medium">Created</TableHead>
                <TableHead className="text-right text-muted-foreground font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No API keys found. Create your first key below.
                  </TableCell>
                </TableRow>
              ) : (
                apiKeys.map((apiKey) => {
                  const isSelected = isKeySelected(apiKey.key_prefix);
                  return (
                    <TableRow 
                      key={apiKey.id}
                      className={isSelected ? "bg-muted/50 border-l-4 border-green-500" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-foreground">{apiKey.name}</span>
                          {apiKey.is_default && (
                            <Badge variant="default" className="bg-green-600 text-white">
                              Default
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-foreground">
                        {apiKey.key_prefix}...
                      </TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(apiKey.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant={isSelected ? "default" : "outline"}
                            className={
                              isSelected
                                ? "bg-green-500 text-white hover:bg-green-600"
                                : "text-green-500 border-green-500 hover:bg-green-500/10"
                            }
                            onClick={() => handleSelect(apiKey.key_prefix)}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            {isSelected ? "Selected" : "Select"}
                          </Button>
                          <Button
                            variant="outline"
                            className="text-red-500 border-red-500 hover:bg-red-500/10"
                            onClick={() => handleDelete(apiKey.id, apiKey.name)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <CreateApiKeyDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreateKey}
      />

      <NewApiKeyModal
        open={isNewKeyModalOpen}
        onOpenChange={setIsNewKeyModalOpen}
        apiKey={newlyCreatedKey || ""}
      />

      <VerifyApiKeyModal
        open={isVerifyModalOpen}
        onOpenChange={setIsVerifyModalOpen}
        keyPrefix={selectedKeyPrefix}
        onVerifySuccess={handleVerifySuccess}
      />
    </AuthenticatedLayout>
  );
}

