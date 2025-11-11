# API Keys Screen

## Overview
A screen for managing API keys, displaying them in a table format with options to create, select, and delete keys. This screen is part of the authenticated layout and includes the shared sidebar.

## Component Structure

### Root Layout
- **Container**: `div`
  - **Props**: `className: "flex h-screen bg-background"`

### Sidebar
- **Component**: `Sidebar` (see `docs/components/sidebar.md`)
- **Props**: Standard sidebar props

### Main Content Area
- **Container**: `div`
  - **Props**: `className: "flex-1 overflow-y-auto p-8"`

### Header Section
- **Title**: `h1`
  - **Props**: `className: "text-4xl font-bold text-white"`
  - **Content**: `"API Keys"`
- **Subtitle**: `p`
  - **Props**: `className: "text-lg text-gray-400 mt-2"`
  - **Content**: `"Manage your Morpheus API keys."`

### My API Keys Section
- **Container**: `div`
  - **Props**: `className: "bg-gray-800 p-6 rounded-lg mt-8"`
- **Section Title**: `h2`
  - **Props**: `className: "text-2xl font-semibold text-white mb-4"`
  - **Content**: `"My API Keys"`

#### API Keys Table
- **Component**: `Table` (from `@/components/ui/table`)
  - **Props**: `className: "w-full"`

##### Table Header
- **Component**: `TableHeader` (from `@/components/ui/table`)
- **Table Row**: `TableRow` (from `@/components/ui/table`)
- **Table Head Cells**: `TableHead` (from `@/components/ui/table`)
  - **Props**: `className: "text-left text-gray-400 font-medium"`
  - **Content**: `"Name"`, `"API Key"`, `"Last Used"`, `"Created"`, `"Actions"`

##### Table Body
- **Component**: `TableBody` (from `@/components/ui/table`)
- **Table Rows**: `TableRow` (from `@/components/ui/table`)
  - Each row represents an API key

**Table Cell Structure**:
- **Name Cell**: `TableCell` (from `@/components/ui/table`)
  - **Content**: Key name (e.g., `"n8n"`)
  - **Badge** (if default): `Badge` (from `@/components/ui/badge`)
    - **Props**: `variant: "default" className: "ml-2 bg-green-600 text-white"`
    - **Content**: `"Default"`
  - **Checkbox** (if not default): `Checkbox` (from `@/components/ui/checkbox`)
    - **Props**: `id: "set-as-default" className: "ml-2"`
    - **Label**: `"Set as default"`

- **API Key Cell**: `TableCell` (from `@/components/ui/table`)
  - **Content**: Truncated API key (e.g., `"sk-nbnsRJ... Arbn5f"`)
  - **Props**: `className: "font-mono text-sm"`

- **Last Used Cell**: `TableCell` (from `@/components/ui/table`)
  - **Content**: Date or relative time (e.g., `"Yesterday"`, `"10/12/2025"`)

- **Created Cell**: `TableCell` (from `@/components/ui/table`)
  - **Content**: Date (e.g., `"Yesterday"`, `"10/5/2025"`)

- **Actions Cell**: `TableCell` (from `@/components/ui/table`)
  - **Select Button**: `Button` (from `@/components/ui/button`)
    - **Props**:
      - `variant`: `"outline"` (or `"default"` if selected)
      - `className`: `"text-green-500 border-green-500 hover:bg-green-900 mr-2"` (or `"bg-green-600 text-white hover:bg-green-700 mr-2"` if selected)
    - **Children**:
      - `Check` icon (from `lucide-react`): `className: "mr-2 h-4 w-4"`
      - `span`: `"Select"` (or `"Selected"` if already selected)
  
  - **Delete Button**: `Button` (from `@/components/ui/button`)
    - **Props**:
      - `variant`: `"outline"`
      - `className`: `"text-red-500 border-red-500 hover:bg-red-900"`
    - **Children**:
      - `Trash2` icon (from `lucide-react`): `className: "mr-2 h-4 w-4"`
      - `span`: `"Delete"`

#### Create New Key Button
- **Component**: `Button` (from `@/components/ui/button`)
- **Props**:
  - `variant`: `"ghost"`
  - `className`: `"mt-4 text-green-500 hover:bg-gray-700"`
  - `onClick`: Opens create API key dialog
- **Children**:
  - `Plus` icon (from `lucide-react`): `className: "mr-2 h-4 w-4"`
  - `span`: `"Create New Key"`

## Implementation Example

```tsx
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
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Trash2, Plus } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { CreateApiKeyDialog } from "@/components/create-api-key-dialog";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  isDefault: boolean;
  isSelected: boolean;
  lastUsed: string;
  created: string;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: "1",
      name: "n8n",
      key: "sk-nbnsRJ-bf5g3a-Arbn5f",
      isDefault: true,
      isSelected: false,
      lastUsed: "Yesterday",
      created: "Yesterday",
    },
    {
      id: "2",
      name: "Test API Key",
      key: "sk-AxNSFT-MbUtSa",
      isDefault: false,
      isSelected: true,
      lastUsed: "10/12/2025",
      created: "10/5/2025",
    },
  ]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleSelect = (id: string) => {
    setApiKeys((keys) =>
      keys.map((key) => ({
        ...key,
        isSelected: key.id === id,
      }))
    );
  };

  const handleDelete = (id: string) => {
    setApiKeys((keys) => keys.filter((key) => key.id !== id));
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-8">
        <h1 className="text-4xl font-bold text-white">API Keys</h1>
        <p className="text-lg text-gray-400 mt-2">Manage your Morpheus API keys.</p>

        <div className="bg-gray-800 p-6 rounded-lg mt-8">
          <h2 className="text-2xl font-semibold text-white mb-4">My API Keys</h2>
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="text-left text-gray-400 font-medium">Name</TableHead>
                <TableHead className="text-left text-gray-400 font-medium">API Key</TableHead>
                <TableHead className="text-left text-gray-400 font-medium">Last Used</TableHead>
                <TableHead className="text-left text-gray-400 font-medium">Created</TableHead>
                <TableHead className="text-left text-gray-400 font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell>
                    {apiKey.name}
                    {apiKey.isDefault ? (
                      <Badge variant="default" className="ml-2 bg-green-600 text-white">
                        Default
                      </Badge>
                    ) : (
                      <div className="flex items-center ml-2">
                        <Checkbox id={`set-as-default-${apiKey.id}`} />
                        <label
                          htmlFor={`set-as-default-${apiKey.id}`}
                          className="ml-2 text-sm text-gray-400"
                        >
                          Set as default
                        </label>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{apiKey.key}</TableCell>
                  <TableCell>{apiKey.lastUsed}</TableCell>
                  <TableCell>{apiKey.created}</TableCell>
                  <TableCell>
                    <Button
                      variant={apiKey.isSelected ? "default" : "outline"}
                      className={
                        apiKey.isSelected
                          ? "bg-green-600 text-white hover:bg-green-700 mr-2"
                          : "text-green-500 border-green-500 hover:bg-green-900 mr-2"
                      }
                      onClick={() => handleSelect(apiKey.id)}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {apiKey.isSelected ? "Selected" : "Select"}
                    </Button>
                    <Button
                      variant="outline"
                      className="text-red-500 border-red-500 hover:bg-red-900"
                      onClick={() => handleDelete(apiKey.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button
            variant="ghost"
            className="mt-4 text-green-500 hover:bg-gray-700"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Key
          </Button>
        </div>
      </div>
      <CreateApiKeyDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
```

## Styling Notes
- Dark theme with `bg-gray-800` for the card container
- Green accent for primary actions and selected states
- Red accent for destructive actions
- Monospace font for API keys
- Table layout for organized data display

