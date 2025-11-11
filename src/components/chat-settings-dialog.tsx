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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Model {
  id: string;
  ModelType?: string;
}

interface ChatSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  models: Model[];
  modelTypes: Array<{ value: string; label: string }>;
  selectedModelType: string;
  onModelTypeChange: (type: string) => void;
}

export function ChatSettingsDialog({
  open,
  onOpenChange,
  selectedModel,
  onModelChange,
  models,
  modelTypes,
  selectedModelType,
  onModelTypeChange,
}: ChatSettingsDialogProps) {
  const [tone, setTone] = useState("");
  const [frequencyPenalty, setFrequencyPenalty] = useState("0");
  const [presencePenalty, setPresencePenalty] = useState("0");
  const [minP, setMinP] = useState("0");
  const [topP, setTopP] = useState("1");
  const [temperature, setTemperature] = useState("0.9");

  useEffect(() => {
    // Load saved settings from localStorage
    const savedTone = localStorage.getItem("chat_tone") || "";
    const savedFrequencyPenalty = localStorage.getItem("chat_frequency_penalty") || "0";
    const savedPresencePenalty = localStorage.getItem("chat_presence_penalty") || "0";
    const savedMinP = localStorage.getItem("chat_min_p") || "0";
    const savedTopP = localStorage.getItem("chat_top_p") || "1";
    const savedTemperature = localStorage.getItem("chat_temperature") || "0.9";

    setTone(savedTone);
    setFrequencyPenalty(savedFrequencyPenalty);
    setPresencePenalty(savedPresencePenalty);
    setMinP(savedMinP);
    setTopP(savedTopP);
    setTemperature(savedTemperature);
  }, []);

  const handleSave = () => {
    // Save settings to localStorage
    localStorage.setItem("chat_tone", tone);
    localStorage.setItem("chat_frequency_penalty", frequencyPenalty);
    localStorage.setItem("chat_presence_penalty", presencePenalty);
    localStorage.setItem("chat_min_p", minP);
    localStorage.setItem("chat_top_p", topP);
    localStorage.setItem("chat_temperature", temperature);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md bg-card text-card-foreground shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Chat Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="select-model">Select Model</Label>
            <Select value={selectedModelType} onValueChange={onModelTypeChange}>
              <SelectTrigger id="select-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedModel} onValueChange={onModelChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assistant Tone */}
          <div className="space-y-2">
            <Label htmlFor="assistant-tone">Assistant Tone/Style</Label>
            <Textarea
              id="assistant-tone"
              placeholder="Describe the assistant's tone and style..."
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="min-h-[80px] bg-input text-input-foreground border-border"
            />
          </div>

          {/* Parameters Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency-penalty">Frequency Penalty</Label>
              <Input
                id="frequency-penalty"
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={frequencyPenalty}
                onChange={(e) => setFrequencyPenalty(e.target.value)}
                className="bg-input text-input-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="presence-penalty">Presence Penalty</Label>
              <Input
                id="presence-penalty"
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={presencePenalty}
                onChange={(e) => setPresencePenalty(e.target.value)}
                className="bg-input text-input-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min-p">Min P</Label>
              <Input
                id="min-p"
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={minP}
                onChange={(e) => setMinP(e.target.value)}
                className="bg-input text-input-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="top-p">Top P</Label>
              <Input
                id="top-p"
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={topP}
                onChange={(e) => setTopP(e.target.value)}
                className="bg-input text-input-foreground border-border"
              />
            </div>
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <Label htmlFor="temperature">Temperature</Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="pr-10 bg-input text-input-foreground border-border"
            />
          </div>
        </div>
        <DialogFooter className="flex justify-end gap-2 pt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            className="bg-green-500 hover:bg-green-600 text-white"
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

