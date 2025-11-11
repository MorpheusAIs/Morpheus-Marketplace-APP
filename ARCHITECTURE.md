# Morpheus API Gateway - Application Architecture

## Table of Contents
1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Application Structure](#application-structure)
4. [Page Layout & Routing](#page-layout--routing)
5. [Authentication System](#authentication-system)
6. [Page-by-Page Functionality](#page-by-page-functionality)
7. [External API Integration](#external-api-integration)
8. [State Management](#state-management)
9. [Security Considerations](#security-considerations)

---

## Overview

The Morpheus API Gateway is a Next.js 15 application that provides a web interface for managing API keys, configuring automation settings, and interacting with AI models through a chat interface. The application serves as a documentation and management portal for the Morpheus API Gateway backend service.

### Key Features
- User authentication via AWS Cognito
- API key management (create, delete, set default)
- Automation settings configuration
- Interactive chat interface with AI models
- Chat history persistence
- Model selection and filtering

---

## Technology Stack

### Frontend Framework
- **Next.js 15.3.2** (React 18.2.0)
- **TypeScript 5.x**
- **Tailwind CSS 3.4.1** for styling
- **PostCSS** for CSS processing

### Authentication
- **AWS Cognito** for user authentication
  - OAuth 2.0 / OpenID Connect flow (redirect-based)
  - Direct API authentication (non-redirect, in-app modal)
- JWT token management (access tokens, ID tokens, refresh tokens)

### State Management
- React Context API
  - `CognitoAuthContext` - Authentication state
  - `NotificationContext` - Global notifications
  - `GTMProvider` - Google Tag Manager integration

### UI Libraries
- **react-markdown** - Markdown rendering for chat messages
- **rehype-highlight** - Code syntax highlighting
- **remark-gfm** - GitHub Flavored Markdown support
- **framer-motion** - Animations
- **@headlessui/react** - UI components

### HTTP Client
- Native `fetch` API for API calls
- Custom `apiService` wrapper for request/response logging

### Analytics
- **Google Tag Manager** (GTM) - Event tracking
- **Google Analytics** - Analytics (optional)

### Build Tools
- **Turbopack** - Fast bundler (development)
- **ESLint** - Code linting
- **TypeScript Compiler** - Type checking

---

## Application Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Home page
│   ├── admin/              # Admin dashboard (protected)
│   ├── chat/               # Chat interface (protected)
│   ├── auth/               # Auth callback handler
│   ├── register/           # Registration page
│   └── login-direct/       # Direct login page
├── components/             # React components
│   ├── auth/
│   │   └── AuthModal.tsx   # In-app authentication modal
│   └── providers/
│       └── GTMProvider.tsx  # Google Tag Manager
├── lib/                    # Core libraries
│   ├── api/               # API client code
│   │   ├── apiService.ts  # HTTP request wrapper
│   │   ├── config.ts      # API endpoints configuration
│   │   └── client.ts      # API client utilities
│   ├── auth/              # Authentication logic
│   │   ├── CognitoAuthContext.tsx    # Auth context provider
│   │   ├── cognito-auth.ts           # Redirect-based auth
│   │   └── cognito-direct-auth.ts    # Direct API auth
│   ├── NotificationContext.tsx       # Global notifications
│   ├── model-filter-utils.ts         # Model filtering logic
│   └── utils/
│       └── gtm.ts          # GTM utilities
└── types/                  # TypeScript type definitions
```

---

## Page Layout & Routing

### Root Layout (`/app/layout.tsx`)

The root layout wraps the entire application with necessary providers:

**Provider Hierarchy:**
```
<NotificationProvider>
  <CognitoAuthProvider>
    <GTMProvider>
      <NotificationManager />
      {children}
    </GTMProvider>
  </CognitoAuthProvider>
</NotificationProvider>
```

**Features:**
- Global CSS styles (`globals.css`)
- Google Tag Manager integration (if configured)
- Google Analytics integration (if configured)
- Inter font from Google Fonts
- Favicon and manifest configuration

---

## Authentication System

### Authentication Methods

The application supports **two authentication methods**:

#### 1. Redirect-Based Authentication (`cognito-auth.ts`)
- **Flow:** User redirected to Cognito hosted UI → callback to `/auth/callback`
- **Used by:** Legacy flows, register page
- **OAuth Flow:**
  1. User clicks login/signup
  2. Redirected to `https://auth.mor.org/oauth2/authorize`
  3. User authenticates with Cognito
  4. Callback to `/auth/callback` with authorization code
  5. Exchange code for tokens
  6. Store tokens and redirect to admin

#### 2. Direct Authentication (`cognito-direct-auth.ts`)
- **Flow:** In-app modal, direct API calls to Cognito
- **Used by:** Modern UI (AuthModal component)
- **API Flow:**
  1. User enters credentials in modal
  2. Direct POST to `https://cognito-idp.{region}.amazonaws.com/`
  3. Receive tokens directly
  4. Store tokens in localStorage
  5. No redirects - seamless UX

### Cognito Configuration

**Environment Variables:**
```bash
NEXT_PUBLIC_COGNITO_REGION=us-east-2
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=gllbg66ej476tsaf2ibfjc7g8
NEXT_PUBLIC_COGNITO_DOMAIN=auth.mor.org
```

**Token Management:**
- **Storage:** localStorage (`cognito_tokens`)
- **Token Types:**
  - `accessToken` - API authentication (expires ~1 hour)
  - `idToken` - User identity information (expires ~1 hour)
  - `refreshToken` - Long-lived token for refreshing (never expires)
- **Auto-refresh:** Tokens automatically refreshed when expired using refresh token

### Auth Context (`CognitoAuthContext`)

**State Management:**
- `user` - Current user information (from ID token)
- `accessToken` - Current access token
- `idToken` - Current ID token
- `apiKeys` - User's API keys list
- `defaultApiKey` - Default API key metadata
- `isAuthenticated` - Boolean authentication status
- `isLoading` - Loading state

**Key Functions:**
- `login()` - Redirect to Cognito login
- `signup()` - Redirect to Cognito signup
- `logout()` - Clear tokens and redirect
- `handleAuthCallback()` - Process OAuth callback
- `refreshApiKeys()` - Fetch updated API keys list

### API Key Verification Flow

**Two-Stage Authentication:**
1. **User Authentication (Cognito JWT)**
   - Required for accessing the application
   - Used for API key management endpoints

2. **API Key Verification**
   - Required for Chat/Test functionality
   - User must verify full API key in Admin page
   - Stored in `sessionStorage` (expires after 24 hours)
   - Enables direct API calls to backend

**Storage Locations:**
- `localStorage`: API key prefix, Cognito tokens
- `sessionStorage`: Verified full API key (temporary)

---

## Page-by-Page Functionality

### 1. Home Page (`/`)

**Route:** `/app/page.tsx`

**Authentication:** Not required (public)

**Functionality:**
- Landing page with application logo and branding
- Navigation cards:
  - **Admin** - Links to `/admin` (shows auth modal if not authenticated)
  - **Chat** - Links to `/chat`
  - **API Docs** - External link to `https://apidocs.mor.org`
- Action buttons:
  - **Login/Logout** - Toggle based on auth status
  - **Register** - Opens auth modal
  - **Swagger UI** - Links to backend Swagger docs
- Auth modal integration for seamless login

**Key Features:**
- Build version watermark
- Responsive design
- Dark theme with neon accents

**External Links:**
- `https://apidocs.mor.org` - External documentation
- `${API_BASE_URL}/docs` - Swagger UI

---

### 2. Admin Dashboard (`/admin`)

**Route:** `/app/admin/page.tsx`

**Authentication:** **REQUIRED** (Protected)

**Protection Logic:**
- If not authenticated: Shows authentication banner with login button
- If authenticated: Shows full dashboard

**Functionality:**

#### API Keys Management
- **Create API Key:**
  - Form input for key name
  - POST to `/api/v1/auth/keys`
  - Returns full key (only shown once)
  - Auto-creates automation settings with defaults (24-hour sessions)
  - GTM event: `api_key_created`

- **List API Keys:**
  - GET from `/api/v1/auth/keys`
  - Shows: name, prefix, creation date, default status
  - Filter: Only active keys displayed

- **Select/Verify API Key:**
  - Click "Select" on an API key
  - Opens verification modal
  - User enters full API key
  - Validates prefix matches
  - Stores verified key in sessionStorage
  - Fetches automation settings

- **Set Default Key:**
  - Checkbox interface
  - PUT to `/api/v1/auth/keys/{keyId}/default`
  - Updates default key preference

- **Delete API Key:**
  - Confirmation modal
  - DELETE to `/api/v1/auth/keys/{keyId}`
  - GTM event: `api_key_deleted`

#### Automation Settings
- **View Settings:**
  - Session duration (seconds)
  - Automation enabled/disabled toggle
  - Only available after API key verification

- **Update Settings:**
  - PUT to `/api/v1/automation/settings`
  - Requires authenticated user (JWT token)
  - Validates session duration > 0
  - Shows unsaved changes indicator

**API Calls:**
- `GET /api/v1/auth/keys` - List API keys
- `POST /api/v1/auth/keys` - Create API key
- `PUT /api/v1/auth/keys/{keyId}/default` - Set default key
- `DELETE /api/v1/auth/keys/{keyId}` - Delete API key
- `GET /api/v1/auth/keys/default` - Get default key metadata
- `GET /api/v1/auth/keys/default/decrypted` - Auto-decrypt default key
- `GET /api/v1/automation/settings` - Get automation settings
- `PUT /api/v1/automation/settings` - Update automation settings

**Key UI Features:**
- Fixed navigation bar with links to Chat, Admin, Docs, Home
- Two-column layout (API Keys | Automation Settings)
- Modal dialogs for verification and deletion
- Success/error notifications via NotificationContext
- Responsive design with mobile support

---

### 3. Chat Interface (`/chat`)

**Route:** `/app/chat/page.tsx`

**Authentication:** **REQUIRED** (Protected - requires API key verification)

**Protection Logic:**
- Checks for verified API key in sessionStorage
- If not verified: Redirects to `/admin` with return URL stored
- Shows authentication banner if not logged in
- Shows API key setup prompt if authenticated but no verified key

**Functionality:**

#### Model Selection
- **Fetch Available Models:**
  - GET `/api/v1/models` (public endpoint, no auth)
  - Filters models by type (configurable via `NEXT_PUBLIC_ALLOWED_MODEL_TYPES`)
  - Default filter: LLM models only
  - Environment default: `NEXT_PUBLIC_DEFAULT_MODEL`

- **Model Type Filter:**
  - Dropdown: All, LLM, UNKNOWN, STT, TTS, EMBEDDING
  - Based on `ModelType` field in API response
  - Configurable via environment variable

- **Model Selection:**
  - Dropdown with filtered models
  - Alphabetically sorted
  - Default model auto-selected based on config

#### Chat Features
- **Send Messages:**
  - POST to `/api/v1/chat/completions`
  - Request body:
    ```json
    {
      "model": "selected-model-id",
      "messages": [
        {"role": "system", "content": "..."},
        {"role": "user", "content": "..."},
        {"role": "assistant", "content": "..."}
      ],
      "stream": false
    }
    ```
  - Uses verified API key as Bearer token
  - Returns assistant response in streaming or non-streaming format

- **Chat History:**
  - Toggle to enable/disable saving
  - Sidebar with chat list
  - Load previous chats: GET `/api/v1/chat-history/chats`
  - Load specific chat: GET `/api/v1/chat-history/chats/{chatId}`
  - Delete chat: DELETE `/api/v1/chat-history/chats/{chatId}`
  - Create new chat: POST `/api/v1/chat-history/chats`
  - Add messages: POST `/api/v1/chat-history/chats/{chatId}/messages`

#### Message Rendering
- **Markdown Support:**
  - Uses `react-markdown` with `remark-gfm`
  - Syntax highlighting with `rehype-highlight`
  - Code blocks, tables, lists, links
  - Custom styling for dark theme

- **Keyboard Shortcuts:**
  - Enter: Send message
  - Shift+Enter / Ctrl+Enter: New line

**API Calls:**
- `GET /api/v1/models` - Fetch available models (public)
- `POST /api/v1/chat/completions` - Send chat message
- `GET /api/v1/chat-history/chats` - List chat history
- `GET /api/v1/chat-history/chats/{chatId}` - Get chat details
- `DELETE /api/v1/chat-history/chats/{chatId}` - Delete chat
- `POST /api/v1/chat-history/chats` - Create new chat
- `POST /api/v1/chat-history/chats/{chatId}/messages` - Add message to chat

**Key UI Features:**
- Fixed navigation bar
- Collapsible sidebar for chat history
- Message input with auto-scroll
- Loading indicators
- Error handling with notifications
- Responsive mobile layout

---

### 4. Auth Callback (`/auth/callback`)

**Route:** `/app/auth/callback/page.tsx`

**Authentication:** Public (handles authentication)

**Functionality:**
- Processes OAuth callback from Cognito
- Extracts `code` and `state` from URL query parameters
- Validates state parameter (CSRF protection)
- Exchanges authorization code for tokens
- Stores tokens in localStorage
- Redirects to `/admin` on success
- Shows error message on failure

**Flow:**
1. User redirected from Cognito with `?code=...&state=...`
2. Component extracts parameters
3. Calls `handleAuthCallback()` from CognitoAuthContext
4. Token exchange via Cognito OAuth endpoint
5. Store tokens and update auth context
6. Redirect to admin dashboard

---

### 5. Register Page (`/register`)

**Route:** `/app/register/page.tsx`

**Authentication:** Not required (public)

**Functionality:**
- Simple registration landing page
- Button to initiate Cognito signup
- Redirects to Cognito hosted signup page
- Redirects to `/admin` if already authenticated

**Note:** This page uses redirect-based authentication. The newer flow uses the AuthModal component directly.

---

### 6. Login Direct (`/login-direct`)

**Route:** `/app/login-direct/page.tsx`

**Authentication:** Not required (public)

**Functionality:**
- Alternative login page
- Opens AuthModal on load if not authenticated
- Checks for existing tokens on mount
- Redirects to `/admin` if authenticated
- Uses direct authentication (no redirects)

---

## External API Integration

### Backend API Base URL

**Configuration:**
- Environment variable: `NEXT_PUBLIC_API_BASE_URL`
- Default: `https://api.mor.org`
- Development: `https://api.dev.mor.org`

### API Endpoints

#### Authentication Endpoints
All require **Bearer JWT token** (Cognito access token):

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/auth/keys` | List user's API keys | JWT |
| POST | `/api/v1/auth/keys` | Create new API key | JWT |
| PUT | `/api/v1/auth/keys/{id}/default` | Set default key | JWT |
| DELETE | `/api/v1/auth/keys/{id}` | Delete API key | JWT |
| GET | `/api/v1/auth/keys/default` | Get default key metadata | JWT |
| GET | `/api/v1/auth/keys/default/decrypted` | Get decrypted default key | JWT |

#### Chat Endpoints
Requires **API Key Bearer token** (verified API key from sessionStorage):

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/chat/completions` | Send chat message | API Key |
| GET | `/api/v1/chat-history/chats` | List chat history | API Key |
| GET | `/api/v1/chat-history/chats/{id}` | Get chat details | API Key |
| DELETE | `/api/v1/chat-history/chats/{id}` | Delete chat | API Key |
| POST | `/api/v1/chat-history/chats` | Create new chat | API Key |
| POST | `/api/v1/chat-history/chats/{id}/messages` | Add message | API Key |

#### Model Endpoints
Public (no authentication required):

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/models` | List available models | None |

#### Automation Endpoints
Requires **Bearer JWT token**:

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/automation/settings` | Get automation settings | JWT |
| PUT | `/api/v1/automation/settings` | Update automation settings | JWT |

#### Documentation Endpoints
Public:

| Endpoint | Description |
|----------|-------------|
| `/docs` | Swagger UI (interactive API docs) |

### Authentication Headers

**For JWT-based endpoints:**
```javascript
{
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
}
```

**For API Key-based endpoints:**
```javascript
{
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  'accept': 'application/json'
}
```

### AWS Cognito API Calls

**Direct Authentication Endpoints:**
- `POST https://cognito-idp.{region}.amazonaws.com/`
  - `X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth`
  - `X-Amz-Target: AWSCognitoIdentityProviderService.SignUp`
  - `X-Amz-Target: AWSCognitoIdentityProviderService.ConfirmSignUp`
  - `X-Amz-Target: AWSCognitoIdentityProviderService.ForgotPassword`
  - `X-Amz-Target: AWSCognitoIdentityProviderService.ConfirmForgotPassword`

**OAuth Endpoints (Redirect-based):**
- `GET https://auth.mor.org/oauth2/authorize` - Authorization
- `POST https://auth.mor.org/oauth2/token` - Token exchange
- `GET https://auth.mor.org/logout` - Logout

---

## State Management

### React Context Providers

#### 1. NotificationProvider
**Location:** `lib/NotificationContext.tsx`

**Purpose:** Global notification system

**State:**
- `notification` - Current active notification

**Methods:**
- `showNotification()` - Show notification
- `dismissNotification()` - Dismiss notification
- `success()` - Show success notification
- `error()` - Show error notification
- `warning()` - Show warning notification
- `info()` - Show info notification

**Usage:**
```typescript
const { success, error } = useNotification();
success('Title', 'Message', { duration: 5000 });
```

#### 2. CognitoAuthProvider
**Location:** `lib/auth/CognitoAuthContext.tsx`

**Purpose:** Authentication state management

**State:**
- `user` - User info from ID token
- `accessToken` - JWT access token
- `idToken` - JWT ID token
- `apiKeys` - Array of API keys
- `defaultApiKey` - Default API key metadata
- `isAuthenticated` - Boolean auth status
- `isLoading` - Loading state

**Methods:**
- `login()` - Initiate login
- `signup()` - Initiate signup
- `logout()` - Clear auth state
- `handleAuthCallback()` - Process OAuth callback
- `refreshApiKeys()` - Fetch API keys

#### 3. GTMProvider
**Location:** `components/providers/GTMProvider.tsx`

**Purpose:** Google Tag Manager integration

**Methods:**
- `trackApiKey()` - Track API key events

### Local Storage

**Items Stored:**
- `cognito_tokens` - JSON object with accessToken, idToken, refreshToken
- `user_info` - User information from ID token
- `selected_api_key_prefix` - Selected API key prefix
- `cognito_auth_state` - OAuth state parameter (temporary)

### Session Storage

**Items Stored:**
- `verified_api_key` - Full verified API key (expires after 24h)
- `verified_api_key_prefix` - API key prefix
- `verified_api_key_timestamp` - Timestamp for expiration check
- `return_to_after_verification` - Return URL after API key verification

---

## Security Considerations

### Authentication Security

1. **JWT Tokens:**
   - Stored in localStorage (accessible to JavaScript)
   - Auto-refresh before expiration
   - Invalid tokens cleared on refresh failure

2. **API Keys:**
   - Full keys stored in sessionStorage (more secure than localStorage)
   - Auto-expire after 24 hours
   - Requires user verification before use
   - Only prefix shown in UI, full key never displayed after creation

3. **OAuth State:**
   - State parameter validated to prevent CSRF
   - Removed immediately after use

4. **Password Requirements:**
   - Minimum 8 characters
   - Uppercase, lowercase, number, special character
   - Validated client-side before submission

### API Security

1. **Token-Based Auth:**
   - JWT tokens for user management endpoints
   - API keys for chat/model endpoints
   - Bearer token format in Authorization header

2. **CORS:**
   - Backend must allow frontend origin
   - Credentials included in requests

3. **Error Handling:**
   - Generic error messages to prevent information leakage
   - Detailed logging only in development

### Data Storage

1. **Sensitive Data:**
   - API keys: sessionStorage (cleared on browser close)
   - Tokens: localStorage (persists across sessions)
   - User info: localStorage

2. **Token Expiration:**
   - Access tokens: ~1 hour
   - Auto-refresh before expiration
   - Logout on refresh failure

---

## Environment Configuration

### Required Environment Variables

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://api.dev.mor.org

# Cognito Configuration
NEXT_PUBLIC_COGNITO_REGION=us-east-2
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=gllbg66ej476tsaf2ibfjc7g8
NEXT_PUBLIC_COGNITO_DOMAIN=auth.mor.org

# Analytics (Optional)
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_GTM_ID=

# Model Filtering
NEXT_PUBLIC_ALLOWED_MODEL_TYPES=LLM
NEXT_PUBLIC_DEFAULT_MODEL=LMR-Hermes-3-Llama-3.1-8B
```

### Build Configuration

**Next.js Config (`next.config.ts`):**
- ESLint ignored during builds
- TypeScript strict mode
- Turbopack for development

**Tailwind Config:**
- Custom color variables (CSS variables)
- Dark theme support
- Custom animations

---

## Deployment

### Build Process

```bash
npm run build  # Production build
npm start      # Start production server
npm run dev    # Development with Turbopack
```

### AWS Amplify

**Configuration:** `amplify.yml` for CI/CD deployment

**Build Settings:**
- Node.js version: >=20.0.0
- Build command: `npm run build`
- Output directory: `.next`

---

## Summary

### Authentication Flow

1. **User visits app** → Not authenticated
2. **Clicks login** → Opens AuthModal or redirects to Cognito
3. **Enters credentials** → Authenticates with Cognito
4. **Receives tokens** → Stored in localStorage
5. **Accesses Admin** → Creates/manages API keys
6. **Verifies API key** → Stored in sessionStorage
7. **Uses Chat** → Requires verified API key

### Protected Pages

- ✅ **`/admin`** - Requires authentication + shows banner if not authenticated
- ✅ **`/chat`** - Requires authentication + API key verification
- ❌ **`/`** - Public
- ❌ **`/register`** - Public
- ❌ **`/auth/callback`** - Public (handles auth)

### Key Architectural Decisions

1. **Dual Authentication:** Both redirect and direct methods supported
2. **Two-Stage Auth:** User auth (JWT) + API key verification
3. **Context API:** Lightweight state management without Redux
4. **API Abstraction:** Centralized API configuration and service layer
5. **Notification System:** Global notification context for user feedback
6. **Progressive Enhancement:** Works without auth, enhanced with auth

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Maintained By:** Development Team

