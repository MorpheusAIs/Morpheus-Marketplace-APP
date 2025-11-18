"use client";

import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Pencil, X } from "lucide-react";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { apiPost, apiDelete, apiPut } from "@/lib/api/apiService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_URLS, API_CONFIG } from "@/lib/api/config";
import { useNotification } from "@/lib/NotificationContext";
import { CreateApiKeyDialog } from "@/components/create-api-key-dialog";
import { NewApiKeyModal } from "@/components/new-api-key-modal";
import { VerifyApiKeyModal } from "@/components/verify-api-key-modal";

interface ApiKeyResponse {
  key: string;
  key_prefix: string;
  name: string;
}

export default function ApiKeysPage() {
  const { apiKeys, accessToken, refreshApiKeys, defaultApiKey } = useCognitoAuth();
  const { success, error } = useNotification();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [selectedKeyPrefix, setSelectedKeyPrefix] = useState<string>("");
  const [isEditingDefaultKey, setIsEditingDefaultKey] = useState(false);
  const [pendingDefaultKeyId, setPendingDefaultKeyId] = useState<number | null>(null);

  // Find the default API key from the apiKeys array
  const currentDefaultKey = apiKeys.find(key => key.is_default) || defaultApiKey;

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

  const handleVerifySuccess = async () => {
    setIsVerifyModalOpen(false);
    setSelectedKeyPrefix("");
    
    // If we were setting a default key, do that now after verification
    if (pendingDefaultKeyId !== null) {
      const pendingKey = apiKeys.find(key => key.id === pendingDefaultKeyId);
      if (pendingKey) {
        await handleSetDefaultKey(pendingKey.id, pendingKey.name);
      }
      setPendingDefaultKeyId(null);
    } else {
      success("API Key Verified", "Your API key has been verified. You can now use Chat and Test features.");
    }
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

  const handleSetDefaultKey = async (keyId: number, keyName: string) => {
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
      setIsEditingDefaultKey(false);
      success("Default API Key Updated", `"${keyName}" is now your default API key and has been verified.`);
    } catch (err) {
      error("Failed to Set Default Key", err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleDefaultKeyChange = (keyId: string) => {
    const selectedKey = apiKeys.find(key => key.id.toString() === keyId);
    if (selectedKey && selectedKey.id !== currentDefaultKey?.id) {
      // Open verification modal first, same as clicking Select in the table
      setPendingDefaultKeyId(selectedKey.id);
      setSelectedKeyPrefix(selectedKey.key_prefix);
      setIsEditingDefaultKey(false); // Close edit mode while verification is happening
      setIsVerifyModalOpen(true);
    } else {
      setIsEditingDefaultKey(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <h1 className="text-2xl md:text-4xl font-bold text-foreground">API Keys</h1>
        <p className="text-base md:text-lg text-muted-foreground mt-2">Manage your Morpheus API keys.</p>

        <div className="bg-card p-4 md:p-6 rounded-lg mt-6 md:mt-8 border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-xl md:text-2xl font-semibold text-foreground">My API Keys</h2>
            <Button
              variant="ghost"
              className="text-green-500 hover:bg-muted w-full sm:w-auto"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Key
            </Button>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
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
                    return (
                      <TableRow 
                        key={apiKey.id}
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
                          <Button
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => handleDelete(apiKey.id, apiKey.name)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {apiKeys.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No API keys found. Create your first key above.
              </div>
            ) : (
              apiKeys.map((apiKey) => (
                <Card key={apiKey.id} className="border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold truncate">{apiKey.name}</CardTitle>
                        {apiKey.is_default && (
                          <Badge variant="default" className="bg-green-600 text-white shrink-0">
                            Default
                          </Badge>
                        )}
                      </div>
                      <span className="font-mono text-xs text-muted-foreground shrink-0">
                        {apiKey.key_prefix}...
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Created:</span>
                      <span className="text-foreground">{formatDate(apiKey.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last Used:</span>
                      <span className="text-foreground">-</span>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <Button
                        variant="ghost"
                        className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => handleDelete(apiKey.id, apiKey.name)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-xs md:text-sm text-muted-foreground break-all md:break-normal">
                Base URL: {" "}
                <a
                  href={API_CONFIG.BASE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-500 hover:text-green-600 underline"
                >
                  {API_CONFIG.BASE_URL}
                </a>
              </p>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <span className="text-xs md:text-sm text-muted-foreground">Default API key:</span>
                {isEditingDefaultKey ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={currentDefaultKey?.id.toString() || ""}
                      onValueChange={handleDefaultKeyChange}
                    >
                      <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="Select API key" />
                      </SelectTrigger>
                      <SelectContent>
                        {apiKeys.map((key) => (
                          <SelectItem key={key.id} value={key.id.toString()}>
                            {key.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
                      onClick={() => setIsEditingDefaultKey(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {currentDefaultKey ? (
                      <Select
                        value={currentDefaultKey.id.toString()}
                        disabled={true}
                      >
                        <SelectTrigger className="w-full md:w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={currentDefaultKey.id.toString()}>
                            {currentDefaultKey.name}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="w-full md:w-[200px] h-9 px-3 py-2 text-sm text-muted-foreground border border-input rounded-md bg-background flex items-center">
                        No default key
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
                      onClick={() => setIsEditingDefaultKey(true)}
                      disabled={apiKeys.length === 0}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateApiKeyDialog
        open={isCreateDialogOpen}
        onOpenChangeAction={setIsCreateDialogOpen}
        onCreateAction={handleCreateKey}
      />

      <NewApiKeyModal
        open={isNewKeyModalOpen}
        onOpenChange={setIsNewKeyModalOpen}
        apiKey={newlyCreatedKey || ""}
      />

      <VerifyApiKeyModal
        open={isVerifyModalOpen}
        onOpenChangeAction={(open) => {
          setIsVerifyModalOpen(open);
          // If modal is closed without success, reset pending default key state
          if (!open && pendingDefaultKeyId !== null) {
            setPendingDefaultKeyId(null);
            setIsEditingDefaultKey(false);
          }
        }}
        keyPrefix={selectedKeyPrefix}
        keyName={apiKeys.find(key => key.key_prefix === selectedKeyPrefix)?.name}
        onVerifySuccessAction={handleVerifySuccess}
      />
    </AuthenticatedLayout>
  );
}

