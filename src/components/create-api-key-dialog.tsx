"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

interface ApiKey {
  id: number;
  key_prefix: string;
  name: string;
  created_at: string;
  is_active: boolean;
  is_default: boolean;
}

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onCreateAction: (name: string) => void;
  existingApiKeys?: ApiKey[];
}

export function CreateApiKeyDialog({
  open,
  onOpenChangeAction,
  onCreateAction,
  existingApiKeys = [],
}: CreateApiKeyDialogProps) {
  const [keyName, setKeyName] = useState("");
  const [duplicateError, setDuplicateError] = useState("");

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setKeyName("");
      setDuplicateError("");
    }
  }, [open]);

  // Check for duplicate names as user types
  useEffect(() => {
    if (keyName.trim()) {
      const trimmedName = keyName.trim();
      const isDuplicate = existingApiKeys.some(
        (key) => key.name.toLowerCase() === trimmedName.toLowerCase()
      );
      
      if (isDuplicate) {
        setDuplicateError("An API key with this name already exists");
      } else {
        setDuplicateError("");
      }
    } else {
      setDuplicateError("");
    }
  }, [keyName, existingApiKeys]);

  const handleSubmit = () => {
    const trimmedName = keyName.trim();
    
    if (!trimmedName) {
      return;
    }

    // Final check for duplicates before submission
    const isDuplicate = existingApiKeys.some(
      (key) => key.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      setDuplicateError("An API key with this name already exists");
      return;
    }

    onCreateAction(trimmedName);
    setKeyName("");
    setDuplicateError("");
    onOpenChangeAction(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="w-[400px] p-6 bg-card text-card-foreground rounded-lg shadow-lg">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold">Create An API Key</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="key-name" className="text-base font-medium">
              Key Name
            </Label>
            <Input
              id="key-name"
              type="text"
              placeholder="Name your API key"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className={`bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring ${
                duplicateError ? "border-red-500 focus-visible:ring-red-500" : ""
              }`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !duplicateError) {
                  handleSubmit();
                }
              }}
            />
            {duplicateError && (
              <p className="text-sm text-red-500 mt-1">{duplicateError}</p>
            )}
          </div>
        </div>
        <DialogFooter className="pt-6">
          <Button
            type="submit"
            className="w-full bg-green-500 text-white hover:bg-green-600 rounded-md py-2 text-lg font-semibold"
            onClick={handleSubmit}
            disabled={!keyName.trim() || !!duplicateError}
          >
            Create Key
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

