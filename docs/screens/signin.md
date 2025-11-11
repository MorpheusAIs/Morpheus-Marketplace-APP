# Sign In Screen

## Overview
A sign-in screen featuring a shared navbar and a centered authentication form. Users can sign in with email and password, recover forgotten passwords, and navigate to account creation.

## Component Structure

### Root Layout
- **Container**: `div`
  - **Props**: `className: "min-h-screen bg-background flex flex-col"`

### Navbar
- **Component**: `Navbar` (see `docs/components/navbar.md`)
- **Props**: Standard navbar props

### Main Content Area
- **Container**: `div`
  - **Props**: `className: "flex-1 flex items-center justify-center p-6"`

### Sign In Form Card
- **Component**: `Card` (from `@/components/ui/card`)
  - **Props**: `className: "w-[400px] mx-auto p-6 bg-card text-card-foreground rounded-lg shadow-lg"`

#### Card Header
- **Component**: `CardHeader` (from `@/components/ui/card`)
  - **Card Title**: `CardTitle` (from `@/components/ui/card`)
    - **Props**: `className: "text-3xl font-bold text-white"`
    - **Content**: `"Sign in"`
  - **Card Description**: `CardDescription` (from `@/components/ui/card`)
    - **Props**: `className: "text-muted-foreground mt-2"`
    - **Content**: `"Sign in with your Morpheus account."`

#### Card Content
- **Component**: `CardContent` (from `@/components/ui/card`)
  - **Form**: `form` (HTML element)
    - **Props**: `className: "space-y-6 mt-6"`

##### Email Field Group
- **Container**: `div`
  - **Props**: `className: "space-y-2"`
  - **Label**: `Label` (from `@/components/ui/label`)
    - **Props**: `htmlFor: "email"`
    - **Content**: `"Email"`
  - **Input Container**: `div`
    - **Props**: `className: "relative"`
    - **Mail Icon**: `Mail` (from `lucide-react`)
      - **Props**: `className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"`
    - **Input**: `Input` (from `@/components/ui/input`)
      - **Props**:
        - `id`: `"email"`
        - `type`: `"email"`
        - `placeholder`: `"example@mor.org"`
        - `className`: `"pl-10 bg-input text-input-foreground border-border"`

##### Password Field Group
- **Container**: `div`
  - **Props**: `className: "space-y-2"`
  - **Label**: `Label` (from `@/components/ui/label`)
    - **Props**: `htmlFor: "password"`
    - **Content**: `"Password"`
  - **Input Container**: `div`
    - **Props**: `className: "relative"`
    - **Input**: `Input` (from `@/components/ui/input`)
      - **Props**:
        - `id`: `"password"`
        - `type`: `"password"` (toggleable to `"text"`)
        - `placeholder`: `"Enter password"`
        - `className`: `"pr-10 bg-input text-input-foreground border-border"`
    - **Eye Icon Button**: `Button` (from `@/components/ui/button`)
      - **Props**:
        - `type`: `"button"`
        - `variant`: `"ghost"`
        - `size`: `"icon"`
        - `className`: `"absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:bg-transparent"`
        - `onClick`: Toggle password visibility handler
      - **Children**: `Eye` or `EyeOff` (from `lucide-react`)

##### Forgot Password Link
- **Component**: `Link` (from `next/link`)
  - **Props**:
    - `href`: `"/forgot-password"`
    - `className`: `"text-sm text-green-500 hover:underline block text-right"`
  - **Content**: `"Forgot your password?"`

##### Sign In Button
- **Component**: `Button` (from `@/components/ui/button`)
  - **Props**:
    - `type`: `"submit"`
    - `className`: `"w-full bg-green-500 hover:bg-green-600 text-white mt-6"`
  - **Children**:
    - `span`: `"Sign in"`
    - `ArrowRight` (from `lucide-react`): `className: "ml-2 h-4 w-4"`

##### Create Account Link
- **Container**: `p` or `div`
  - **Props**: `className: "text-center text-sm text-muted-foreground mt-4"`
  - **Content**: `"First time? "`
  - **Link**: `Link` (from `next/link`)
    - **Props**:
      - `href`: `"/signup"`
      - `className`: `"text-green-500 hover:underline"`
    - **Content**: `"Create an account"`

## Implementation Example

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/navbar";

export default function SignInPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-[400px] mx-auto p-6 bg-card text-card-foreground rounded-lg shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-white">Sign in</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Sign in with your Morpheus account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6 mt-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@mor.org"
                    className="pl-10 bg-input text-input-foreground border-border"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    className="pr-10 bg-input text-input-foreground border-border"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm text-green-500 hover:underline block text-right"
              >
                Forgot your password?
              </Link>
              <Button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-white mt-6">
                <span>Sign in</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-center text-sm text-muted-foreground mt-4">
                First time?{" "}
                <Link href="/signup" className="text-green-500 hover:underline">
                  Create an account
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

## Styling Notes
- Dark theme using Shadcn UI theme variables
- Green accent color (`bg-green-500 hover:bg-green-600`) for primary actions and links
- Fixed card width (`w-[400px]`) with horizontal centering
- Icons positioned absolutely within input fields
- Password visibility toggle functionality required

