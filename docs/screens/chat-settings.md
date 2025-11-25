# Chat Settings Screen

## Overview
A modal dialog or card form for configuring chat settings, including model selection, assistant tone, and various generation parameters (frequency penalty, presence penalty, temperature, etc.).

## Component Structure

### Root Container
- **Container**: `div`
  - **Props**: `className: "relative flex h-screen w-screen items-center justify-center bg-background-dark"` (if full screen) or wrapped in `Dialog`

### Dialog (if modal)
- **Component**: `Dialog` (from `@/components/ui/dialog`)
- **Props**:
  - `open`: `boolean`
  - `onOpenChange`: `(open: boolean) => void`

### Dialog Content / Card
- **Component**: `DialogContent` (from `@/components/ui/dialog`) or `Card` (from `@/components/ui/card`)
- **Props**: `className: "w-full max-w-md bg-card text-card-foreground shadow-lg"`

#### Card Header
- **Component**: `DialogHeader` or `CardHeader` (from `@/components/ui/card`)
- **Card Title**: `DialogTitle` or `CardTitle` (from `@/components/ui/card`)
  - **Props**: `className: "text-2xl font-bold"`
  - **Content**: `"Chat Settings"`

#### Card Content
- **Component**: `DialogContent` (body) or `CardContent` (from `@/components/ui/card`)
- **Props**: `className: "space-y-6"`

##### Select Model Section
- **Container**: `div`
  - **Props**: `className: "space-y-2"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "select-model"`
  - **Content**: `"Select Model"`
- **Select**: `Select` (from `@/components/ui/select`)
  - **Props**: `defaultValue: "mistral-31-24b"`
  - **SelectTrigger**: `SelectTrigger` (from `@/components/ui/select`)
    - **Props**: `id: "select-model" className: "w-full"`
  - **SelectValue**: `SelectValue` (from `@/components/ui/select`)
    - **Props**: `placeholder: "Select a model"`
  - **SelectContent**: `SelectContent` (from `@/components/ui/select`)
    - **SelectItems**: `SelectItem` (from `@/components/ui/select`)
      - **Props**: `value: "{modelId}"`
      - **Content**: Model name
- **Helper Text**: `p`
  - **Props**: `className: "text-sm text-muted-foreground"`
  - **Content**: `"19 models available"`

##### Assistant Tone/Style Section
- **Container**: `div`
  - **Props**: `className: "space-y-2"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "assistant-tone"`
  - **Content**: `"Assistant Tone/Style"`
- **Textarea**: `Textarea` (from `@/components/ui/textarea`)
  - **Props**:
    - `id`: `"assistant-tone"`
    - `placeholder`: `"Modify the assistant's tone"`
    - `className`: `"min-h-[80px] resize-y"`

##### Parameter Grid
- **Container**: `div`
  - **Props**: `className: "grid grid-cols-2 gap-4"`

**Frequency Penalty**:
- **Container**: `div`
  - **Props**: `className: "space-y-2"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "frequency-penalty"`
  - **Content**: `"Frequency Penalty"`
- **Input**: `Input` (from `@/components/ui/input`)
  - **Props**:
    - `id`: `"frequency-penalty"`
    - `type`: `"number"`
    - `step`: `"0.1"`
    - `min`: `"0"`
    - `max`: `"2"`
    - `defaultValue`: `"0.7"`
    - `className`: `"pr-10"`

**Presence Penalty**:
- Same structure as Frequency Penalty
- **Props**: `id: "presence-penalty" defaultValue: "0.5"`

**Min P**:
- Same structure
- **Props**: `id: "min-p" min: "0" max: "1" defaultValue: "0.2"`

**Top P**:
- Same structure
- **Props**: `id: "top-p" min: "0" max: "1" defaultValue: "0.9"`

##### Temperature Section
- **Container**: `div`
  - **Props**: `className: "space-y-2"`
- **Label**: `Label` (from `@/components/ui/label`)
  - **Props**: `htmlFor: "temperature"`
  - **Content**: `"Temperature"`
- **Input**: `Input` (from `@/components/ui/input`)
  - **Props**:
    - `id`: `"temperature"`
    - `type`: `"number"`
    - `step`: `"0.1"`
    - `min`: `"0"`
    - `max`: `"2"`
    - `defaultValue`: `"0.9"`
    - `className`: `"pr-10"`

#### Card Footer / Dialog Footer
- **Component**: `DialogFooter` (from `@/components/ui/dialog`) or `CardFooter` (from `@/components/ui/card`)
- **Props**: `className: "flex justify-end gap-2 pt-6"`
- **Cancel Button**: `Button` (from `@/components/ui/button`)
  - **Props**: `variant: "ghost"`
  - **Content**: `"Cancel"`
- **Save Changes Button**: `Button` (from `@/components/ui/button`)
  - **Props**:
    - `variant`: `"default"`
    - `className`: `"bg-green-500 hover:bg-green-600 text-white"`
  - **Content**: `"Save Changes"`

## Implementation Example

```tsx
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChatSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings?: {
    model: string;
    tone: string;
    frequencyPenalty: number;
    presencePenalty: number;
    minP: number;
    topP: number;
    temperature: number;
  };
  onSave: (settings: ChatSettings) => void;
}

export function ChatSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: ChatSettingsProps) {
  const [formData, setFormData] = useState({
    model: settings?.model || "mistral-31-24b",
    tone: settings?.tone || "",
    frequencyPenalty: settings?.frequencyPenalty || 0.7,
    presencePenalty: settings?.presencePenalty || 0.5,
    minP: settings?.minP || 0.2,
    topP: settings?.topP || 0.9,
    temperature: settings?.temperature || 0.9,
  });

  const handleSave = () => {
    onSave(formData);
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
            <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
              <SelectTrigger id="select-model" className="w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mistral-31-24b">mistral-31-24b</SelectItem>
                <SelectItem value="gpt-4">gpt-4</SelectItem>
                <SelectItem value="claude-3">claude-3</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">19 models available</p>
          </div>

          {/* Assistant Tone */}
          <div className="space-y-2">
            <Label htmlFor="assistant-tone">Assistant Tone/Style</Label>
            <Textarea
              id="assistant-tone"
              placeholder="Modify the assistant's tone"
              value={formData.tone}
              onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
              className="min-h-[80px] resize-y"
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
                value={formData.frequencyPenalty}
                onChange={(e) =>
                  setFormData({ ...formData, frequencyPenalty: parseFloat(e.target.value) })
                }
                className="pr-10"
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
                value={formData.presencePenalty}
                onChange={(e) =>
                  setFormData({ ...formData, presencePenalty: parseFloat(e.target.value) })
                }
                className="pr-10"
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
                value={formData.minP}
                onChange={(e) => setFormData({ ...formData, minP: parseFloat(e.target.value) })}
                className="pr-10"
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
                value={formData.topP}
                onChange={(e) => setFormData({ ...formData, topP: parseFloat(e.target.value) })}
                className="pr-10"
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
              value={formData.temperature}
              onChange={(e) =>
                setFormData({ ...formData, temperature: parseFloat(e.target.value) })
              }
              className="pr-10"
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
```

## Styling Notes
- Dark theme using Shadcn UI theme variables
- Grid layout for parameter inputs (2 columns)
- Number inputs with step, min, and max constraints
- Green accent for primary action
- Responsive max-width for modal

