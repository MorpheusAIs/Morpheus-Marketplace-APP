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
import { ArrowRight } from "lucide-react";

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  onCreateAction: (name: string) => void;
}

export function CreateApiKeyDialog({
  open,
  onOpenChangeAction,
  onCreateAction,
}: CreateApiKeyDialogProps) {
  const [keyName, setKeyName] = useState("");

  const handleSubmit = () => {
    if (keyName.trim()) {
      onCreateAction(keyName.trim());
      setKeyName("");
      onOpenChangeAction(false);
    }
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
              className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter className="pt-6">
          <Button
            type="submit"
            className="w-full bg-green-500 text-white hover:bg-green-600 rounded-md py-2 text-lg font-semibold"
            onClick={handleSubmit}
            disabled={!keyName.trim()}
          >
            Create Key
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

