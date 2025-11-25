# Sign Up Screen

## Overview
A sign-up screen featuring a shared navbar and a centered registration form. Users can create a new account with email and password confirmation.

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

### Sign Up Form Card
- **Component**: `Card` (from `@/components/ui/card`)
  - **Props**: `className: "w-full max-w-md p-6 bg-card text-card-foreground rounded-lg shadow-lg"`

#### Card Header
- **Component**: `CardHeader` (from `@/components/ui/card`)
  - **Props**: `className: "text-center space-y-2"`
  - **Card Title**: `CardTitle` (from `@/components/ui/card`)
    - **Props**: `className: "text-3xl font-bold text-foreground"`
    - **Content**: `"Sign up"`
  - **Card Description**: `CardDescription` (from `@/components/ui/card`)
    - **Props**: `className: "text-muted-foreground"`
    - **Content**: `"Create a Morpheus account to continue."`

#### Card Content
- **Component**: `CardContent` (from `@/components/ui/card`)
  - **Props**: `className: "space-y-6"`
  - **Form**: `form` (HTML element)

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
        - `type`: `"password"` (toggleable)
        - `placeholder`: `"Enter password"`
        - `className`: `"pr-10 bg-input text-input-foreground border-border"`
    - **Eye Icon Button**: `Button` (from `@/components/ui/button`)
      - **Props**:
        - `type`: `"button"`
        - `variant`: `"ghost"`
        - `size`: `"icon"`
        - `className`: `"absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:bg-transparent"`
        - `onClick`: Toggle password visibility handler
      - **Children**: `Eye` or `EyeOff` (from `lucide-react`)

##### Confirm Password Field Group
- **Container**: `div`
  - **Props**: `className: "space-y-2"`
  - **Label**: `Label` (from `@/components/ui/label`)
    - **Props**: `htmlFor: "confirm-password"`
    - **Content**: `"Confirm Password"`
  - **Input Container**: `div`
    - **Props**: `className: "relative"`
    - **Input**: `Input` (from `@/components/ui/input`)
      - **Props**:
        - `id`: `"confirm-password"`
        - `type`: `"password"` (toggleable)
        - `placeholder`: `"Re-enter Password"`
        - `className`: `"pr-10 bg-input text-input-foreground border-border"`
    - **Eye Icon Button**: `Button` (from `@/components/ui/button`)
      - **Props**: Same as password field eye button
      - **Children**: `Eye` or `EyeOff` (from `lucide-react`)

##### Continue Button
- **Component**: `Button` (from `@/components/ui/button`)
  - **Props**:
    - `type`: `"submit"`
    - `className`: `"w-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center space-x-2"`
  - **Children**:
    - `span`: `"Continue"`
    - `ArrowRight` (from `lucide-react`): `className: "ml-2 h-4 w-4"`

#### Card Footer
- **Component**: `CardFooter` (from `@/components/ui/card`)
  - **Props**: `className: "text-center justify-center text-sm text-muted-foreground"`
  - **Content**: `"Already have an account? "`
  - **Link**: `Link` (from `next/link`)
    - **Props**:
      - `href`: `"/signin"`
      - `className`: `"text-green-500 hover:underline ml-1"`
    - **Content**: `"Sign in"`

## Implementation Example

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/navbar";

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 bg-card text-card-foreground rounded-lg shadow-lg">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold text-foreground">Sign up</CardTitle>
            <CardDescription className="text-muted-foreground">
              Create a Morpheus account to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter Password"
                  className="pr-10 bg-input text-input-foreground border-border"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center space-x-2"
            >
              <span>Continue</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
          <CardFooter className="text-center justify-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/signin" className="text-green-500 hover:underline ml-1">
              Sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
```

## Styling Notes
- Dark theme using Shadcn UI theme variables
- Green accent color (`bg-green-500 hover:bg-green-600`) for primary actions and links
- Maximum width constraint (`max-w-md`) for responsive design
- Password visibility toggles for both password fields
- Form validation should ensure passwords match

