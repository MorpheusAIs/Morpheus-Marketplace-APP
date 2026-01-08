"use client";

import { useState } from "react";
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

interface VerifyApiKeyModalProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  keyPrefix: string;
  keyName?: string;
  onVerifySuccessAction: () => void;
}

export function VerifyApiKeyModal({
  open,
  onOpenChangeAction,
  keyPrefix,
  keyName,
  onVerifySuccessAction,
}: VerifyApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (!apiKey.trim()) {
      setError("Please enter your API key");
      return;
    }

    const normalizedInput = apiKey.trim();
    if (!normalizedInput.toLowerCase().startsWith(keyPrefix.toLowerCase())) {
      setError(`API key must start with "${keyPrefix}"`);
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      // Store verified key in sessionStorage
      sessionStorage.setItem("verified_api_key", normalizedInput);
      sessionStorage.setItem("verified_api_key_prefix", keyPrefix);
      sessionStorage.setItem("verified_api_key_timestamp", Date.now().toString());
      if (keyName) {
        sessionStorage.setItem("verified_api_key_name", keyName);
      }
      localStorage.setItem("selected_api_key_prefix", keyPrefix);

      setApiKey("");
      setIsVerifying(false);
      onOpenChangeAction(false);
      onVerifySuccessAction();
    } catch (err) {
      setError("Verification failed. Please try again.");
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setApiKey("");
    setError("");
    onOpenChangeAction(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-card text-foreground rounded-lg p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            Verify Your API Key
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mt-4">
          You've selected: <span className="font-mono">{keyPrefix}...</span>
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          To ensure the security of your data, we need you to verify the full API key to
          enable Test functionality.
        </p>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="api-key-input" className="text-base font-semibold text-foreground">
              Enter Full API Key
            </Label>
            <Input
              id="api-key-input"
              type="password"
              placeholder={`${keyPrefix}...`}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError("");
              }}
              className="col-span-4 bg-input border-input text-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleVerify();
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-1 col-span-4">
              Must start with "{keyPrefix}"
            </p>
            {error && (
              <p className="text-xs text-red-500 mt-1 col-span-4">{error}</p>
            )}
          </div>
        </div>
        <DialogFooter className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            className="bg-green-500 hover:bg-green-600 text-white"
            onClick={handleVerify}
            disabled={isVerifying || !apiKey.trim()}
          >
            {isVerifying ? "Verifying..." : "Verify & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

