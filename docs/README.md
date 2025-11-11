# Screen Documentation Index

This directory contains detailed markdown documentation for all screens and shared components in the Morpheus Marketplace application.

## Structure

### Styling Guide (`docs/`)
- **`styling-guide.md`** - Complete styling guide with color palette, component-specific styling, and theme variables

### Shared Components (`docs/components/`)
- **`navbar.md`** - Shared navigation bar used across authentication screens (sign-in, sign-up)
- **`sidebar.md`** - Shared sidebar component for authenticated screens with different states (default, chat route active, etc.)

### Authentication Screens (`docs/screens/`)
- **`signin.md`** - Sign in screen with email/password authentication
- **`signup.md`** - Sign up screen for creating new accounts

### API Management Screens (`docs/screens/`)
- **`api-keys.md`** - Main API keys management screen with table view
- **`create-api-key.md`** - Modal/form for creating new API keys
- **`new-api-key-modal.md`** - Modal displaying newly created API key
- **`verify-api-key-modal.md`** - Modal for verifying full API key before enabling features

### Chat Screens (`docs/screens/`)
- **`chat-screen.md`** - Main chat interface with message display and input
- **`chat-settings.md`** - Settings modal for configuring chat parameters (model, tone, penalties, temperature)

### Testing Screen (`docs/screens/`)
- **`api-test.md`** - API testing interface with cURL request generation

### Account Management Screens (`docs/screens/`)
- **`account-settings.md`** - Main account settings screen with authentication and automation settings
- **`change-email-modal.md`** - Modal for changing email address
- **`change-password-modal.md`** - Modal for changing password
- **`delete-account-modal.md`** - Confirmation modal for account deletion

## Component Libraries Used

### Shadcn UI Components
All screens use components from the Shadcn UI library:
- `Button`, `Card`, `Input`, `Label`, `Textarea`
- `Dialog`, `AlertDialog`, `Select`, `Switch`
- `Table`, `Tabs`, `Badge`, `Checkbox`
- `ScrollArea`, `Separator`

### AI Elements Components
Chat-related screens use components from `@ai-elements`:
- `Message` - For displaying chat messages
- `Conversation` - For conversation container
- `CodeBlock` - For displaying code with syntax highlighting
- `PromptInput` - For chat input field

### Assistant UI Components
Additional chat components from `@assistant-ui`:
- `MarkdownText` - For rendering markdown content in messages
- `Thread` - For thread management (if needed)

### Icons
All icons are from `lucide-react`:
- Navigation: `Key`, `MessageSquare`, `FlaskConical`, `FileText`, `User`, `LogOut`
- Actions: `Plus`, `Trash2`, `Check`, `Copy`, `Edit`, `Settings`, `Send`
- UI: `Eye`, `EyeOff`, `ArrowRight`, `ExternalLink`, `ChevronDown`, `MoreHorizontal`
- Status: `CheckCircle`, `RefreshCw`, `ThumbsUp`, `ThumbsDown`

## Styling Guide

See **`styling-guide.md`** for complete color specifications and styling patterns.

### Color Palette
- **Green** (`bg-green-500`): Primary actions, links, success states
- **Purple** (`bg-purple-800`): User chat message bubbles
- **Pink** (`#FD67C4`): Account-related action buttons
- **Red** (`text-red-500`, `bg-red-500`, etc.): Warnings and destructive actions

## Implementation Notes

1. **Dark Theme**: All screens use a dark theme with Shadcn UI theme variables (`bg-background`, `text-foreground`, `bg-card`, etc.)

2. **Color Accents**:
   - **Green** (`bg-green-500`): Primary actions, verified status, success states
   - **Purple** (`bg-purple-800`): User chat message bubbles
   - **Pink** (`#FD67C4`): Account-related action buttons (Change email/password)
   - **Red** (`text-red-500`, `bg-red-500`, `border-red-500`): Warnings and destructive actions

3. **Responsive Design**: Components use Tailwind CSS responsive classes and max-width constraints

4. **Form Validation**: All forms include validation logic and error handling

5. **State Management**: Components use React hooks (`useState`, `useEffect`) for local state

6. **TypeScript**: All examples are written in TypeScript with proper type definitions

## Usage

Each documentation file includes:
- **Overview**: High-level description of the screen
- **Component Structure**: Detailed breakdown of all components and their props
- **Implementation Example**: Complete TypeScript/React code example
- **Styling Notes**: Important styling considerations and theme variables

To implement a screen, refer to its corresponding markdown file for complete component specifications, prop definitions, and example code.

