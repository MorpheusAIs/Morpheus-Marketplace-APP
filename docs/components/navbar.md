# Navbar Component

## Overview
A shared navigation bar component used across authentication screens (sign-in and sign-up). It provides branding, external links, and navigation actions.

## Component Structure

### Root Element
- **Component**: `nav` (HTML semantic element)
- **Props**:
  - `className`: `"flex items-center justify-between h-16 px-6 bg-background text-foreground border-b border-border"`

### Left Section (Branding)
- **Container**: `div`
  - **Props**: `className: "flex items-center space-x-3"`
  
  - **Logo**: `img` or custom SVG component
    - **Props**:
      - `src`: `/path/to/morpheus-logo.svg`
      - `alt`: `"Morpheus Logo"`
      - `className`: `"h-6 w-auto"`
  
  - **Application Name**: `p` or `span`
    - **Props**: `className: "text-lg font-semibold text-white"`
    - **Content**: `"API Gateway Admin"`

### Right Section (Navigation/Actions)
- **Container**: `div`
  - **Props**: `className: "flex items-center space-x-4"`
  
  - **External Link**: `Link` (from `next/link`)
    - **Props**:
      - `href`: `"https://mor.org"`
      - `target`: `"_blank"`
      - `rel`: `"noopener noreferrer"`
      - `className`: `"text-sm text-muted-foreground hover:text-white flex items-center space-x-1"`
    - **Children**:
      - `span`: `"mor.org"`
      - `ExternalLink` icon (from `lucide-react`): `className: "h-4 w-4"`
  
  - **Sign In Button**: `Button` (from `@/components/ui/button`)
    - **Props**:
      - `variant`: `"default"`
      - `className`: `"bg-green-500 hover:bg-green-600 text-white"`
      - `asChild`: `true` (if wrapping Link)
    - **Content**: `"Sign In"`
    - **Note**: If navigating, wrap with `Link` from `next/link` or use `asChild` prop

## Implementation Example

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface NavbarProps {
  logoComponent: React.ReactNode;
  appName?: string;
  externalLinkHref?: string;
  externalLinkText?: string;
  signInHref?: string;
}

export function Navbar({
  logoComponent,
  appName = "API Gateway Admin",
  externalLinkHref = "https://mor.org",
  externalLinkText = "mor.org",
  signInHref = "/signin",
}: NavbarProps) {
  return (
    <nav className="flex items-center justify-between h-16 px-6 bg-background text-foreground border-b border-border">
      <div className="flex items-center space-x-3">
        {logoComponent}
        <p className="text-lg font-semibold text-white">{appName}</p>
      </div>
      <div className="flex items-center space-x-4">
        <Link
          href={externalLinkHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-white flex items-center space-x-1"
        >
          <span>{externalLinkText}</span>
          <ExternalLink className="h-4 w-4" />
        </Link>
        <Link href={signInHref}>
          <Button variant="default" className="bg-green-500 hover:bg-green-600 text-white">
            Sign In
          </Button>
        </Link>
      </div>
    </nav>
  );
}
```

## Styling Notes
- Uses Shadcn UI theme variables: `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`
- Green accent color (`bg-green-500`) for primary actions
- Fixed height (`h-16`) for consistent layout
- Border bottom for visual separation

