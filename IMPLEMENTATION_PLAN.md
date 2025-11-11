# Morpheus Marketplace App Refactor Plan

## Overview
This plan refactors the application to implement:
1. New authentication pages (signin/signup) with Navbar component
2. Authenticated layout with Sidebar component for logged-in users
3. Direct Cognito authentication (replacing OAuth redirect flow)
4. Four main authenticated screens: API Keys, Chat, Test, and Account Settings
5. All associated modals for each screen

**Important Notes:**
- API endpoints are already implemented on backend (api.mor.org)
- Use existing `apiService.ts` and `config.ts` files - do NOT create new API service files
- Refactor existing pages (`/admin` → `/api-keys`, `/chat` already exists)
- CognitoAuthContext already exists but uses OAuth - refactor to direct auth
- NotificationContext already exists - use it for all notifications
- API_URLS helper functions already exist in `config.ts`

---

## Phase 1: Layout & Authentication Pages

### 1.1 Create Navbar Component
- **File**: `src/components/navbar.tsx` (NEW)
- Create reusable Navbar component per `docs/components/navbar.md`
- Include logo, app name, external link to mor.org, and Sign In button
- Use Shadcn UI Button component with green accent styling
- Make it responsive and accessible

### 1.2 Create Sign In Page
- **File**: `src/app/signin/page.tsx` (NEW - replace `/login-direct`)
- Implement sign-in page per `docs/screens/signin.md`
- Use Navbar component at top
- Create centered Card with email/password form
- Add password visibility toggle
- Include "Forgot password" link and "Create account" link
- Style with dark theme and green accents
- Integrate with Cognito direct auth (Phase 2)

### 1.3 Create Sign Up Page
- **File**: `src/app/signup/page.tsx` (REFACTOR EXISTING)
- Implement sign-up page per `docs/screens/signup.md`
- Use Navbar component at top
- Create centered Card with email, password, and confirm password fields
- Add password visibility toggles for both password fields
- Include validation for matching passwords
- Add "Sign in" link in footer
- Style with dark theme and green accents
- Integrate with Cognito direct auth (Phase 2)

### 1.4 Create Sidebar Component
- **File**: `src/components/sidebar.tsx` (NEW)
- Implement Sidebar component per `docs/components/sidebar.md`
- Include logo and app name in header
- Add navigation links: API Keys (`/api-keys`), Chat (`/chat`), Test (`/test`), Docs (external)
- Implement Chat section expansion when on `/chat` route
- Add chat history list with scroll area (use existing `API_URLS.chatHistory()`)
- Include "Save Chat History" toggle (reference existing `/chat` implementation)
- Add footer with Account (`/account`) and Log Out buttons
- Connect Log Out to `useCognitoAuth().logout()`
- Style with dark theme (`bg-gray-900`) per styling guide
- Make active states visible with `bg-gray-800`
- Use lucide-react icons throughout

### 1.5 Create Authenticated Layout Component
- **File**: `src/components/authenticated-layout.tsx` (NEW)
- Create wrapper component that includes Sidebar
- Accept children prop for main content area
- Structure: `flex h-screen bg-background` with Sidebar and main content
- Main content area: `flex-1 overflow-y-auto`
- Protect routes by checking authentication state using `useCognitoAuth()`
- Show loading state while checking auth
- Redirect to `/signin` if not authenticated
- Only render children when authenticated

### 1.6 Update Root Layout
- **File**: `src/app/layout.tsx` (NO CHANGES NEEDED)
- CognitoAuthProvider already wraps all routes
- Keep existing NotificationProvider and GTMProvider
- No changes to metadata or other providers

---

## Phase 2: Direct Cognito Authentication Refactor

### 2.1 Install AWS SDK Dependency
- **File**: `package.json`
- Add `@aws-sdk/client-cognito-identity-provider` package
- Version: `^3.x.x`

### 2.2 Create Cognito Configuration File
- **File**: `src/lib/auth/cognito-config.ts` (NEW)
- Export `cognitoConfig` object with:
  - `region`: from `NEXT_PUBLIC_COGNITO_REGION`
  - `userPoolClientId`: from `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID`
  - `domain`: from `NEXT_PUBLIC_COGNITO_DOMAIN`
- Add validation to ensure all env vars are present

### 2.3 Create Cognito Types File
- **File**: `src/lib/types/cognito.ts` (NEW or add to existing types file)
- Define `CognitoUser` interface:
  - `email: string`
  - `accessToken: string`
  - `idToken: string`
  - `refreshToken: string`

### 2.4 Refactor Cognito Auth Context
- **File**: `src/lib/auth/CognitoAuthContext.tsx` (REFACTOR EXISTING)
- **Keep existing state management**: `user`, `accessToken`, `idToken`, `apiKeys`, `defaultApiKey`, `isAuthenticated`, `isLoading`
- **Keep existing functions**: `refreshApiKeys()`, token refresh logic
- **Replace OAuth methods** with direct authentication:
  - Replace `login()` → `signIn(email, password)` using `InitiateAuthCommand` with `USER_PASSWORD_AUTH`
  - Replace `signup()` → `signUp(email, password)` using `SignUpCommand`
  - After signup, automatically sign in the user
  - Remove `handleAuthCallback()` (no longer needed)
- **Update token storage**: Keep existing `cognito_tokens` structure or migrate to individual keys
- **Update `signOut()`**: Clear all tokens and redirect to `/signin`
- **Keep existing**: ID token parsing, token expiration handling, automatic refresh
- **Maintain backward compatibility** with existing token storage format if possible

### 2.5 Update Sign In Page Integration
- **File**: `src/app/signin/page.tsx`
- Connect form submission to `signIn` from `useCognitoAuth`
- Add loading state during authentication
- Handle errors using `useNotification()` hook
- Redirect to `/api-keys` on successful sign-in
- Show validation errors for empty fields

### 2.6 Update Sign Up Page Integration
- **File**: `src/app/signup/page.tsx`
- Connect form submission to `signUp` from `useCognitoAuth`
- Add loading state during registration
- Handle errors using `useNotification()` hook
- Validate password match before submission
- Redirect to `/api-keys` on successful sign-up
- Show validation errors

### 2.7 Update Authenticated Layout Protection
- **File**: `src/components/authenticated-layout.tsx`
- Use `useCognitoAuth()` to check authentication
- Show loading state while checking auth (`isLoading`)
- Redirect to `/signin` if not authenticated (`!isAuthenticated`)
- Only render children when authenticated

### 2.8 Deprecate OAuth Callback Handler
- **File**: `src/app/auth/callback/page.tsx` (EXISTS - mark as deprecated)
- Add deprecation notice in file comments
- Keep file temporarily for backward compatibility
- Redirect to `/signin` if accessed (or remove route entirely)

---

## Phase 3: API Keys Screen

### 3.1 Create API Keys Page
- **File**: `src/app/api-keys/page.tsx` (NEW - refactor from `/admin`)
- Implement page per `docs/screens/api-keys.md`
- Use AuthenticatedLayout wrapper
- Create header with title and subtitle
- Build "My API Keys" section with Card background
- Implement Table component with columns:
  - Name (with Default badge or "Set as default" checkbox)
  - API Key (truncated, monospace font)
  - Last Used
  - Created
  - Actions (Select and Delete buttons)
- Add "Create New Key" button at bottom
- Style with dark theme and green accents per styling guide
- **Reuse existing API logic from `/admin` page**:
  - Use `useCognitoAuth().apiKeys` from context
  - Use `useCognitoAuth().refreshApiKeys()` to refresh list
  - Use existing API calls: `apiPost(API_URLS.keys(), {name}, accessToken)`, `apiDelete(API_URLS.deleteKey(id), accessToken)`, `apiPut(API_URLS.setDefaultKey(id), {}, accessToken)`

### 3.2 Create Create API Key Dialog
- **File**: `src/components/create-api-key-dialog.tsx` (NEW)
- Implement modal per `docs/screens/create-api-key.md`
- Use Dialog component from Shadcn UI
- Include input field for key name
- Add "Create Key" button with ArrowRight icon
- Handle form submission
- Call API: `apiPost(API_URLS.keys(), {name}, accessToken)` (use existing function)
- Open NewApiKeyModal on success with returned key

### 3.3 Create New API Key Modal
- **File**: `src/components/new-api-key-modal.tsx` (NEW)
- Implement modal per `docs/screens/new-api-key-modal.md`
- Display generated API key in orange-bordered box
- Add copy button with visual feedback (Check icon when copied)
- Show warning that key won't be shown again
- Use monospace font for key display
- Add "Close" button

### 3.4 Create Verify API Key Modal
- **File**: `src/components/verify-api-key-modal.tsx` (NEW)
- Implement modal per `docs/screens/verify-api-key-modal.md`
- Show selected key prefix
- Require user to enter full API key
- Validate that entered key starts with prefix
- Add password input type for security
- **Verification**: Store verified key in sessionStorage (no API call needed - just store it)
- Show error messages for invalid keys
- Enable Chat/Test functionality on successful verification (store in sessionStorage)

### 3.5 Integrate Modals with API Keys Page
- **File**: `src/app/api-keys/page.tsx`
- Add state management for all modals
- Connect "Create New Key" button to CreateApiKeyDialog
- Connect "Select" button to VerifyApiKeyModal
- Handle API key selection and verification flow
- Update table after key creation/deletion (call `refreshApiKeys()`)
- Store verified key in sessionStorage for Chat/Test use:
  - `sessionStorage.setItem('verified_api_key', fullKey)`
  - `sessionStorage.setItem('verified_api_key_prefix', prefix)`
  - `sessionStorage.setItem('verified_api_key_timestamp', Date.now().toString())`

### 3.6 Use Existing API Service Functions
- **File**: `src/lib/api/apiService.ts` (EXISTS - use existing)
- Use existing `apiGet`, `apiPost`, `apiPut`, `apiDelete` functions
- Use existing `API_URLS` from `src/lib/api/config.ts`:
  - `API_URLS.keys()` - GET list of keys
  - `API_URLS.keys()` - POST to create key (with body `{name}`)
  - `API_URLS.deleteKey(keyId)` - DELETE key
  - `API_URLS.setDefaultKey(keyId)` - PUT to set default
  - `API_URLS.defaultKeyDecrypted()` - GET decrypted default key (for verification)
- All functions already handle Bearer token authentication
- Reference existing `/admin` page implementation for API call patterns

---

## Phase 4: Chat Screen

### 4.1 Refactor Chat Page
- **File**: `src/app/chat/page.tsx` (REFACTOR EXISTING)
- Keep existing API integration and chat functionality
- Update layout to use AuthenticatedLayout wrapper (remove existing nav bar)
- Update styling per `docs/screens/chat-screen.md`:
  - Chat header with title and API key display
  - Settings button in header
  - Message styling: purple for user, gray for assistant
  - Message metadata with action buttons
- Keep existing message sending logic
- Keep existing chat history sidebar logic (may move to main Sidebar component)
- Update to use new Sidebar component instead of inline sidebar
- Check for verified API key, redirect to `/api-keys` if not verified (already implemented)

### 4.2 Create Chat Settings Dialog
- **File**: `src/components/chat-settings-dialog.tsx` (NEW)
- Implement dialog per `docs/screens/chat-settings.md`
- Include model selection dropdown (use `API_URLS.models()` to fetch)
- Add Assistant Tone/Style textarea
- Create parameter grid (2 columns):
  - Frequency Penalty
  - Presence Penalty
  - Min P
  - Top P
- Add Temperature input
- Include Cancel and Save Changes buttons
- Store settings in state/localStorage
- Apply settings to chat API calls

### 4.3 Integrate Chat Settings
- **File**: `src/app/chat/page.tsx`
- Connect Settings button to ChatSettingsDialog
- Load saved settings on mount
- Apply settings to chat completion API calls
- Update settings when user saves changes

### 4.4 Use Existing Chat API Integration
- **File**: `src/app/chat/page.tsx` (implement inline)
- Use existing API calls from current `/chat` implementation:
  - `API_URLS.chatCompletions()` - POST chat messages
  - `API_URLS.chatHistory()` - GET chat list
  - `API_URLS.chatDetail(chatId)` - GET specific chat
  - `API_URLS.chatMessages(chatId)` - POST messages to chat
- Use verified API key from sessionStorage (already implemented)
- Reference existing chat message sending logic
- Keep existing streaming response handling if present
- Use existing `apiPost`, `apiGet` functions from `apiService.ts`

### 4.5 Update Sidebar Chat History
- **File**: `src/components/sidebar.tsx`
- Load chat history using existing API: `API_URLS.chatHistory()` via `apiGet`
- Display chat history items when on `/chat` route
- Allow selecting chat from history (navigate to `/chat?chatId=...`)
- Add "New Chat" button functionality (clear current chat, start new)
- Implement "Save Chat History" toggle (reference existing implementation in `/chat` page)
- Store chat history preference in localStorage
- Pass chat history props to Sidebar from Chat page or fetch in Sidebar

---

## Phase 5: API Test Screen

### 5.1 Create Test Page
- **File**: `src/app/test/page.tsx` (NEW)
- Implement page per `docs/screens/api-test.md`
- Use AuthenticatedLayout wrapper
- Create header with title and subtitle
- Build API Key Selection Card:
  - Display selected API key (truncated) from sessionStorage
  - Show "Ready for Testing" badge with Check icon
  - Add "Switch Key" button (redirects to `/api-keys`)
- Create Model Type Selection Card:
  - Two dropdowns: Model Type and Model
  - Show "X models available" text
  - Use `API_URLS.models()` to fetch models
- Create User Prompt Card:
  - Textarea for prompt input
  - "Send Request" button
- Create Select Output Card:
  - Tabs: Response Content, Curl Request, Server Response
  - Code block for cURL command
  - Display response content
  - Display raw server response
- Check for verified API key, redirect to `/api-keys` if not verified

### 5.2 Implement API Test Functions
- **File**: `src/app/test/page.tsx` (implement inline)
- Use existing `API_URLS.chatCompletions()` endpoint
- Use existing `apiPost` function from `apiService.ts`
- Generate cURL command from current settings (model, prompt, API key)
- Send test request to backend using verified API key from sessionStorage
- Return response content and raw response
- Handle errors using existing `useNotification()` hook

### 5.3 Integrate Test Page with API
- **File**: `src/app/test/page.tsx`
- Connect "Send Request" button to test function
- Update tabs with response data
- Format cURL command with current settings (reference existing chat implementation)
- Display response in appropriate tab
- Add loading states
- Handle errors with notifications using `useNotification()`

### 5.4 Add Model Selection Logic
- **File**: `src/app/test/page.tsx`
- Fetch available models from API: `apiGet(API_URLS.models())` (public endpoint)
- Populate Model Type dropdown
- Filter models by type (reference existing model filtering logic)
- Update model count display
- Store selected model in state

---

## Phase 6: Account Settings Screen

### 6.1 Create Account Settings Page
- **File**: `src/app/account/page.tsx` (NEW - extract from `/admin` automation settings)
- Implement page per `docs/screens/account-settings.md`
- Use AuthenticatedLayout wrapper
- Create header with title and subtitle
- Build Account Authentication Card:
  - Email Address field with Change button (from `useCognitoAuth().user.email`)
  - Password field with Change button
  - Delete Account section with warning
- Build Automation Settings Card:
  - Selected API Key display with verification status (from context)
  - Session Duration input (reference existing `/admin` implementation)
  - Enable Automation toggle (reference existing `/admin` implementation)
  - Cancel and Save Changes buttons
- Load user data from auth context (`useCognitoAuth().user`)
- Load API key info from context (`useCognitoAuth().defaultApiKey`)

### 6.2 Create Change Email Modal
- **File**: `src/components/change-email-modal.tsx` (NEW)
- Implement modal per `docs/screens/change-email-modal.md`
- Include input for new email address
- Add validation for email format
- Show warning about email confirmation requirement
- Use pink accent (`#FD67C4`) for primary button
- **Note**: Check if backend endpoint exists for email change, or add to `config.ts` if needed
- Handle API call to change email (use `apiPost` or `apiPut` with accessToken)
- Show loading and error states using `useNotification()`

### 6.3 Create Change Password Modal
- **File**: `src/components/change-password-modal.tsx` (NEW)
- Implement modal per `docs/screens/change-password-modal.md`
- Include three password fields:
  - Previous Password
  - New Password
  - Confirm New Password
- Add password visibility toggles for all fields
- Validate password match
- Validate minimum length (8 characters)
- Use green accent for primary button
- **Note**: Use Cognito `ChangePasswordCommand` or check if backend endpoint exists
- Handle API call to change password
- Show loading and error states using `useNotification()`

### 6.4 Create Delete Account Modal
- **File**: `src/components/delete-account-modal.tsx` (NEW)
- Implement modal per `docs/screens/delete-account-modal.md`
- Use AlertDialog component
- Show warning message
- Require user to type "Delete" to confirm
- Disable delete button until confirmation matches
- Use red accent for destructive action
- **Note**: Check if backend endpoint exists for account deletion, or add to `config.ts` if needed
- Handle API call to delete account (use `apiDelete` with accessToken)
- Sign out user and redirect to home on success

### 6.5 Integrate Modals with Account Settings
- **File**: `src/app/account/page.tsx`
- Add state management for all modals
- Connect Change buttons to respective modals
- Connect Delete Account button to DeleteAccountModal
- Handle form submissions
- Update UI after successful changes
- Refresh user data after email/password change

### 6.6 Use Existing API Functions for Account Management
- **File**: `src/app/account/page.tsx` (implement inline)
- Use existing `apiPost`, `apiPut`, `apiDelete` functions from `apiService.ts`
- For automation settings: Use `API_URLS.automationSettings()` (GET/PUT) - already exists
- For email/password changes: Check if backend endpoints exist in `API_URLS` or add to `config.ts` if needed
- For account deletion: Check if endpoint exists or add to `config.ts`
- Use authenticated requests with `accessToken` from `useCognitoAuth()`
- Handle errors using existing `useNotification()` hook
- Reference existing `/admin` page automation settings implementation

---

## Phase 7: Route Protection & Navigation

### 7.1 Update Route Protection
- Protect `/api-keys`, `/chat`, `/test`, `/account` routes using AuthenticatedLayout
- Redirect unauthenticated users to `/signin`
- Check for verified API key on `/chat` and `/test`:
  - Check `sessionStorage.getItem('verified_api_key')`
  - Redirect to `/api-keys` if API key not verified

### 7.2 Update Home Page
- **File**: `src/app/page.tsx` (REFACTOR EXISTING)
- Redirect authenticated users to `/api-keys` (instead of `/admin`)
- Keep current design for unauthenticated users
- Update navigation links:
  - Admin → API Keys (`/api-keys`)
  - Chat → `/chat` (keep)
  - API Docs → External link (keep)
- Update auth modal integration to use new signin/signup pages

### 7.3 Update Sidebar Logout
- **File**: `src/components/sidebar.tsx`
- Connect Log Out button to `useCognitoAuth().logout()`
- Clear all stored data (tokens, API keys, chat history)
- Redirect to `/signin` after logout

### 7.4 Add Route Redirects
- **File**: `src/app/admin/page.tsx` or middleware
- Redirect `/admin` to `/api-keys` (maintain backward compatibility)
- **File**: `src/app/signin/page.tsx`
- Redirect to `/api-keys` if already authenticated
- **File**: `src/app/signup/page.tsx`
- Redirect to `/api-keys` if already authenticated
- **File**: `src/app/login-direct/page.tsx`
- Redirect to `/signin` or mark as deprecated

---

## Phase 8: Styling & Polish

### 8.1 Apply Consistent Styling
- Review all components against `docs/styling-guide.md`
- Ensure consistent use of:
  - Green accents for primary actions (`bg-green-500 hover:bg-green-600`)
  - Purple accents for chat/user messages (`bg-purple-800`)
  - Red accents for destructive actions (`bg-red-600 hover:bg-red-700`)
  - Pink accent (`#FD67C4`) for account-related actions
- Apply dark theme consistently
- Use Shadcn UI theme variables (`bg-background`, `text-foreground`, etc.)

### 8.2 Add Loading States
- Add loading spinners for all async operations
- Show skeleton loaders where appropriate
- Disable buttons during loading
- Use existing loading patterns from current pages

### 8.3 Add Error Handling
- Display user-friendly error messages
- Use `useNotification()` hook for all error notifications
- Handle network errors gracefully
- Show retry options where appropriate

### 8.4 Add Form Validation
- Validate all form inputs
- Show inline error messages
- Prevent submission of invalid forms
- Use Zod or similar for schema validation (if needed)

---

## Phase 9: Testing & Cleanup

### 9.1 Remove Deprecated Code
- **File**: `src/app/auth/callback/page.tsx` - Mark as deprecated (OAuth callback no longer needed)
- **File**: `src/lib/auth/cognito-auth.ts` - Keep for now but mark as deprecated (redirect-based auth)
- **File**: `src/app/admin/page.tsx` - Consider redirecting to `/api-keys` or removing after migration
- **File**: `src/app/login-direct/page.tsx` - May be replaced by `/signin` page
- Remove unused imports from refactored files
- Clean up any duplicate authentication logic

### 9.2 Test Authentication Flow
- Test sign in flow with direct authentication
- Test sign up flow with direct authentication
- Test sign out flow (clears tokens and redirects)
- Test token refresh (automatic refresh before expiration)
- Test protected route access (redirects to `/signin` if not authenticated)
- Test API key verification flow

### 9.3 Test All Screens
- Test API Keys page (`/api-keys`) and all modals
- Test Chat page (`/chat`) and settings dialog
- Test Test page (`/test`) functionality
- Test Account Settings (`/account`) and all modals
- Test navigation between pages
- Test Sidebar navigation and chat history

### 9.4 Verify API Integration
- Test all API endpoints using existing `apiService.ts` functions
- Verify authentication headers (JWT tokens for user endpoints, API keys for chat/test)
- Test error handling with `useNotification()` hook
- Verify data persistence (localStorage for tokens, sessionStorage for API keys)
- Test API key creation, selection, verification, deletion
- Test chat message sending and history
- Test automation settings updates

---

## File Structure Summary

### New Components
- `src/components/navbar.tsx` (NEW)
- `src/components/sidebar.tsx` (NEW)
- `src/components/authenticated-layout.tsx` (NEW)
- `src/components/create-api-key-dialog.tsx` (NEW)
- `src/components/new-api-key-modal.tsx` (NEW)
- `src/components/verify-api-key-modal.tsx` (NEW)
- `src/components/chat-settings-dialog.tsx` (NEW)
- `src/components/change-email-modal.tsx` (NEW)
- `src/components/change-password-modal.tsx` (NEW)
- `src/components/delete-account-modal.tsx` (NEW)

### New/Refactored Pages
- `src/app/signin/page.tsx` (NEW - replace `/login-direct`)
- `src/app/signup/page.tsx` (REFACTOR EXISTING)
- `src/app/api-keys/page.tsx` (NEW - refactor from `/admin`)
- `src/app/chat/page.tsx` (REFACTOR EXISTING - update layout/styling)
- `src/app/test/page.tsx` (NEW)
- `src/app/account/page.tsx` (NEW - extract from `/admin` automation settings)

### Updated Auth Files
- `src/lib/auth/cognito-config.ts` (NEW)
- `src/lib/auth/CognitoAuthContext.tsx` (REFACTOR EXISTING - change to direct auth)
- `src/lib/types/cognito.ts` (NEW or add to existing types)

### Existing Files to Use (No Changes Needed)
- `src/lib/api/apiService.ts` (EXISTS - use existing functions)
- `src/lib/api/config.ts` (EXISTS - use existing API_URLS)
- `src/lib/NotificationContext.tsx` (EXISTS - use existing hook)
- `src/components/providers/GTMProvider.tsx` (EXISTS - use existing)

### Deprecated Files (Mark for Removal)
- `src/app/auth/callback/page.tsx` (OAuth callback - no longer needed)
- `src/app/admin/page.tsx` (Replace with `/api-keys` and `/account`)
- `src/app/login-direct/page.tsx` (Replace with `/signin`)

---

## Implementation Notes

### API Integration Pattern
All API calls should follow this pattern:
```typescript
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api/apiService';
import { API_URLS } from '@/lib/api/config';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';

const { accessToken } = useCognitoAuth();
const response = await apiPost(API_URLS.keys(), { name: 'My Key' }, accessToken);
```

### Authentication Pattern
All authenticated pages should use:
```typescript
import { AuthenticatedLayout } from '@/components/authenticated-layout';

export default function MyPage() {
  return (
    <AuthenticatedLayout>
      {/* Page content */}
    </AuthenticatedLayout>
  );
}
```

### Notification Pattern
All notifications should use:
```typescript
import { useNotification } from '@/lib/NotificationContext';

const { success, error, warning, info } = useNotification();
success('Title', 'Message');
```

### API Key Verification Pattern
Check for verified API key:
```typescript
const verifiedKey = sessionStorage.getItem('verified_api_key');
if (!verifiedKey) {
  router.push('/api-keys');
}
```

