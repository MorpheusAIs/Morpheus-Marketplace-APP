# Local Developer Guide - Morpheus APP

This guide provides comprehensive instructions for developers contributing to the Morpheus APP project, including environment setup, local development, and the contribution workflow.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Environment Configuration](#environment-configuration)
4. [Local Development](#local-development)
5. [Building from Source](#building-from-source)
6. [Development Guidelines](#development-guidelines)
7. [Branch Strategy & Workflow](#branch-strategy--workflow)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js**: Version 22.x or higher (see `.nvmrc` for exact version)
  ```bash
  node --version  # Should show v22.x or higher
  ```

- **pnpm**: Version 9.15.0 or higher (project uses pnpm as package manager)
  ```bash
  # Install pnpm if not already installed
  npm install -g pnpm
  
  pnpm --version  # Should show 9.15.0 or higher
  ```

- **Git**: For version control
  ```bash
  git --version
  ```

### Access Requirements

- GitHub account with access to the `morpheusais/morpheus-marketplace-app` repository
- Understanding of Next.js, React, and TypeScript

---

## Initial Setup

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/morpheusais/morpheus-marketplace-app.git

# Navigate to the project directory
cd morpheus-marketplace-app
```

### 2. Install Dependencies

```bash
# Install all project dependencies using pnpm
pnpm install
```

This will install all required packages listed in `package.json`, including:
- Next.js 15.5.9
- React 18.2.0
- AWS Cognito integration libraries
- Tailwind CSS and shadcn/ui components
- TypeScript and type definitions
- Web3 libraries (wagmi, viem, Reown AppKit)
- Payment integrations (Stripe, Coinbase Commerce)
- React Query for data fetching
- Recharts for analytics visualizations

### 3. Verify Installation

```bash
# Check that dependencies installed correctly
pnpm list --depth=0
```

---

## Environment Configuration

### Step 1: Copy Environment Template

```bash
# Copy the example environment file
cp env.example .env.local
```

### Step 2: Configure Environment Variables

Edit `.env.local` with your local development configuration. The `env.example` file is pre-configured with **dev environment** values, so you can use it directly for local development:

```env
# =============================================================================
# API Configuration
# =============================================================================
# Dev endpoint (default for local development)
NEXT_PUBLIC_API_BASE_URL=https://api.dev.mor.org

# =============================================================================
# Authentication - AWS Cognito Configuration
# =============================================================================
NEXT_PUBLIC_COGNITO_REGION=us-east-2
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=gllbg66ej476tsaf2ibfjc7g8
NEXT_PUBLIC_COGNITO_DOMAIN=auth.mor.org

# =============================================================================
# Analytics - Google Analytics & Google Tag Manager
# =============================================================================
# Leave empty to disable tracking in development
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_GTM_ID=

# =============================================================================
# Model Filtering Configuration
# =============================================================================
NEXT_PUBLIC_ALLOWED_MODEL_TYPES=LLM, EMBEDDING
NEXT_PUBLIC_DEFAULT_MODEL=hermes-4-14b

# =============================================================================
# Automation Settings Defaults
# =============================================================================
NEXT_PUBLIC_DEFAULT_AUTOMATION_ENABLED=true

################################################################################
# 5 SECRETS BELOW - DO NOT SHARE WITH ANYONE
################################################################################

# Admin API Authentication
ADMIN_API_SECRET=

# Payment Integration - Coinbase Commerce
COINBASE_COMMERCE_API_KEY=
COINBASE_COMMERCE_API_SECRET=
COINBASE_COMMERCE_WEBHOOK_SECRET=

# Reown AppKit Configuration (Web3 Wallet Connection)
NEXT_PUBLIC_PROJECT_ID=
```

### Environment Variable Reference

#### Public Variables (Client-side)

| Variable | Purpose | Dev Value |
|----------|---------|-----------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API endpoint | `https://api.dev.mor.org` |
| `NEXT_PUBLIC_COGNITO_REGION` | AWS region | `us-east-2` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID` | Cognito client | `gllbg66ej476tsaf2ibfjc7g8` |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | Auth domain | `auth.mor.org` |
| `NEXT_PUBLIC_GA_ID` | Google Analytics | Leave empty for dev |
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager | Leave empty for dev |
| `NEXT_PUBLIC_ALLOWED_MODEL_TYPES` | Model types to display | `LLM, EMBEDDING` |
| `NEXT_PUBLIC_DEFAULT_MODEL` | Default model selection | `hermes-4-14b` |
| `NEXT_PUBLIC_DEFAULT_AUTOMATION_ENABLED` | Default automation state | `true` |

#### Secrets (5 required for full functionality)

| Variable | Purpose | Notes |
|----------|---------|-------|
| `ADMIN_API_SECRET` | Admin API authentication | Must match backend's `ADMIN_API_SECRET` |
| `COINBASE_COMMERCE_API_KEY` | Coinbase Commerce API key | Required for payment testing |
| `COINBASE_COMMERCE_API_SECRET` | Coinbase Commerce API secret | Required for payment testing |
| `COINBASE_COMMERCE_WEBHOOK_SECRET` | Webhook verification secret | Required for webhook testing |
| `NEXT_PUBLIC_PROJECT_ID` | Reown AppKit project ID | Get from [Reown Dashboard](https://dashboard.reown.com) |

> ⚠️ **Important**: The `.env.local` file is gitignored and should NEVER be committed to the repository. Never share secrets!

> 💡 **Tip**: The env.example is pre-configured for local development with the dev API. For basic development (chat, auth, API keys), you don't need any secrets. Secrets are only needed for payment flows and Web3 wallet connection.

---

## Local Development

### Starting the Development Server

```bash
# Start the Next.js development server with Turbopack
pnpm dev
```

The application will be available at:
- **URL**: http://localhost:3000
- **Hot Reload**: Enabled (changes auto-refresh)
- **Turbopack**: Fast refresh and optimized builds

### Testing Authentication

1. Navigate to http://localhost:3000
2. Click "Sign In" or navigate to `/signin`
3. Sign up for a new account (`/signup`) or sign in with existing credentials
4. Confirm registration via email if signing up (`/confirm-registration`)
5. Create an API key in the API Keys page
6. Test the Chat interface

### Testing Features Locally

#### Home Page
- **URL**: http://localhost:3000
- **Features**: Landing page with navigation

#### Authentication Pages
- **Sign In**: http://localhost:3000/signin
- **Sign Up**: http://localhost:3000/signup
- **Forgot Password**: http://localhost:3000/forgot-password
- **Confirm Registration**: http://localhost:3000/confirm-registration
- **Auth Required**: No

#### Chat Interface
- **URL**: http://localhost:3000/chat
- **Features**: Interactive chat, model selection, chat history, streaming responses
- **Auth Required**: Yes (with verified API key)

#### API Keys Management
- **URL**: http://localhost:3000/api-keys
- **Features**: Create/delete API keys, view key usage
- **Auth Required**: Yes

#### Billing Dashboard
- **URL**: http://localhost:3000/billing
- **Features**: View balance, fund account (Stripe/Coinbase/Crypto), transaction history, usage overview
- **Auth Required**: Yes

#### Usage Analytics
- **URL**: http://localhost:3000/usage-analytics
- **Features**: Detailed usage charts, spending breakdown by model, data export
- **Auth Required**: Yes

#### Account Settings
- **URL**: http://localhost:3000/account
- **Features**: Change email, change password, delete account
- **Auth Required**: Yes

### Development Tools

#### ESLint
```bash
# Run linter to check code quality
pnpm lint
```

#### TypeScript Type Checking
```bash
# Check types without building
pnpm exec tsc --noEmit
```

---

## Building from Source

### Local Production Build

```bash
# Create an optimized production build
pnpm build
```

This will:
1. Compile TypeScript to JavaScript
2. Optimize React components
3. Generate static pages where possible
4. Bundle and minify assets
5. Create a `.next` directory with build artifacts

### Testing Production Build Locally

```bash
# First, build the application
pnpm build

# Then start the production server
pnpm start
```

Access the production build at: http://localhost:3000

> 💡 **Tip**: Always test your changes with a production build before creating a PR to ensure there are no build-time issues.

### Build Verification Checklist

Before submitting a PR:

- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] ESLint passes without errors
- [ ] All pages load correctly
- [ ] Authentication flows work (sign in, sign up, password reset)
- [ ] API key management functions properly
- [ ] Chat interface operates as expected
- [ ] Billing page loads (if you have payment credentials configured)

---

## Development Guidelines

### Code Style

- **TypeScript**: All new code must use TypeScript
- **React**: Use functional components with hooks
- **Formatting**: Follow the project's ESLint configuration
- **Comments**: Add comments for complex logic
- **Naming**: Use descriptive variable and function names

### File Organization

```
src/
├── app/                        # Next.js App Router (routes)
│   ├── api/                   # API routes (webhooks, payments)
│   │   ├── coinbase/         # Coinbase payment endpoints
│   │   ├── stripe/           # Stripe payment endpoints
│   │   └── webhooks/         # Payment webhook handlers
│   ├── account/              # Account settings page
│   ├── api-keys/             # API key management page
│   ├── auth/callback/        # OAuth callback handler
│   ├── billing/              # Billing dashboard
│   ├── chat/                 # Chat interface
│   │   └── [chatId]/        # Dynamic chat routes
│   ├── confirm-registration/ # Email confirmation page
│   ├── forgot-password/      # Password reset page
│   ├── register/             # Registration page
│   ├── signin/               # Sign in page
│   ├── signup/               # Sign up page
│   └── usage-analytics/      # Usage analytics pages
│       └── export-data/      # Data export page
├── components/               # Reusable components
│   ├── ai-elements/         # Chat/AI components (conversation, messages)
│   ├── auth/                # Auth-specific components
│   ├── billing/             # Billing components (charts, tables, widgets)
│   ├── providers/           # Context providers (GTM, Query)
│   └── ui/                  # shadcn/ui components
├── config/                   # Configuration files
│   └── appkit.tsx           # Reown AppKit config (Web3)
├── context/                  # React context providers
│   └── AppKitProvider.tsx   # Web3 wallet provider
├── hooks/                    # Custom React hooks
├── lib/                      # Utility libraries
│   ├── api/                 # API client & services
│   ├── auth/                # Authentication logic (Cognito)
│   ├── hooks/               # Library-specific hooks
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Helper functions
└── types/                    # Global TypeScript types
```

### Best Practices

1. **Component Design**
   - Keep components small and focused
   - Use TypeScript interfaces for props
   - Implement proper error handling
   - Add loading states for async operations
   - Use shadcn/ui components from `src/components/ui/`

2. **State Management**
   - Use React Context for global state (see `src/context/` and `src/lib/`)
   - Use React Query (TanStack Query) for server state and API data
   - Keep local state minimal
   - Use custom hooks from `src/lib/hooks/` (e.g., `use-billing.ts`)

3. **API Calls**
   - Use the `apiService.ts` helper functions in `src/lib/api/`
   - Use the `billing.ts` service for billing-related calls
   - Handle errors gracefully with try/catch
   - Show user-friendly error messages via toast notifications
   - Implement proper loading indicators

4. **Authentication**
   - Never store sensitive tokens in localStorage
   - Use the CognitoAuth context for auth state (`src/lib/auth/CognitoAuthContext.tsx`)
   - Check authentication status before protected operations
   - Handle token expiration gracefully
   - Use `authenticated-layout.tsx` wrapper for protected pages

5. **Web3 Integration**
   - Use the AppKit provider for wallet connections (`src/context/AppKitProvider.tsx`)
   - Configure supported chains in `src/config/appkit.tsx`
   - Handle wallet connection states appropriately

6. **Security**
   - Never commit credentials or API keys
   - Server-side secrets (e.g., `COINBASE_COMMERCE_API_SECRET`) should never have `NEXT_PUBLIC_` prefix
   - Validate user input
   - Sanitize data before rendering
   - Use environment variables for configuration

---

## Branch Strategy & Workflow

### Branch Naming Convention

Use the following prefixes for branch names:

- `feature/` - New features
- `fix/` - Bug fixes
- `hotfix/` - Urgent fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `test/` - Test additions or modifications

**Examples:**
```
feature/add-model-filtering
fix/chat-history-loading
hotfix/cognito-callback-error
refactor/api-service-layer
docs/update-developer-guide
```

### Development Workflow

#### Step 1: Create a Feature Branch

```bash
# Ensure you're on dev branch and up to date
git checkout dev
git pull origin dev

# Create a new feature branch
git checkout -b feature/your-feature-name
```

#### Step 2: Make Your Changes

1. Write your code following the development guidelines
2. Test thoroughly in your local environment (http://localhost:3000)
3. Run the linter and fix any issues
4. Build and test the production build locally

```bash
# Run linter
pnpm lint

# Test production build
pnpm build
pnpm start
```

#### Step 3: Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "Add feature: descriptive message about what you did"
```

**Commit Message Guidelines:**
- Use present tense ("Add feature" not "Added feature")
- Be descriptive but concise
- Reference issue numbers if applicable

#### Step 4: Push to GitHub

```bash
# Push your branch to GitHub
git push origin feature/your-feature-name
```

#### Step 5: Create a Pull Request

1. Go to the GitHub repository
2. Click "New Pull Request"
3. Select your feature branch → `dev` branch
4. Fill in the PR template:
   - **Title**: Clear, descriptive title
   - **Description**: What changes were made and why
   - **Testing**: How you tested the changes
   - **Screenshots**: If applicable (for UI changes)

### Pull Request Requirements

#### PR to `dev` Branch

- ✅ **1 peer review** required before merge
- ✅ All CI checks must pass
- ✅ No merge conflicts with dev
- ✅ Code follows project guidelines
- ✅ Local testing completed successfully
- ✅ Build succeeds without errors

Once merged to `dev`, AWS Amplify will automatically deploy your changes to:
- **Dev Environment**: https://app.dev.mor.org

This is where you and the team can test and review your changes in a live environment before they're promoted to production.

#### PR from `dev` to `main` Branch

When code in the dev environment is stable and ready:

- ✅ **2 peer reviews** required before merge
- ✅ All CI checks must pass
- ✅ Thorough testing completed on https://app.dev.mor.org
- ✅ No critical bugs identified
- ✅ Stakeholder approval (if required)

Once merged to `main`, AWS Amplify will automatically deploy to production:
- **Production Environment**: https://app.mor.org

> ⚠️ **Note**: Only stable, well-tested code should be merged to `main`. All development and testing should happen through the `dev` branch first.

### Code Review Process

**As a Reviewer:**
1. Check code quality and style
2. Verify the PR description is clear
3. Review for potential bugs or edge cases
4. Check that tests pass
5. Provide constructive feedback
6. Approve only when satisfied

**As an Author:**
1. Respond to all review comments
2. Make requested changes promptly
3. Re-request review after changes
4. Thank reviewers for their time

### Deployment Flow Summary

```
┌─────────────────┐
│ Local Dev       │
│ localhost:3000  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Feature Branch  │
│ (your-feature)  │
└────────┬────────┘
         │
         ▼ PR (1 review)
┌─────────────────┐
│ dev branch      │
└────────┬────────┘
         │
         ▼ Auto-deploy
┌─────────────────┐
│ Dev Environment │
│ app.dev.mor.org │
└────────┬────────┘
         │
         ▼ PR (2 reviews)
┌─────────────────┐
│ main branch     │
└────────┬────────┘
         │
         ▼ Auto-deploy
┌─────────────────┐
│ Production      │
│ app.mor.org     │
└─────────────────┘
```

---

## Troubleshooting

### Common Issues

#### Issue: `pnpm install` fails

**Solution:**
```bash
# Clear pnpm cache
pnpm store prune

# Delete node_modules and lockfile
rm -rf node_modules pnpm-lock.yaml

# Reinstall
pnpm install
```

#### Issue: Wrong Node.js version

**Solution:**
```bash
# Check required version in .nvmrc
cat .nvmrc  # Shows 22

# If using nvm, switch to correct version
nvm install 22
nvm use 22

# Verify
node --version  # Should show v22.x
```

#### Issue: "Cannot find module" errors

**Solution:**
This is usually a TypeScript language server issue:

1. Ensure `node_modules` exists: `pnpm install`
2. Restart your IDE
3. In VS Code/Cursor: Reload window (Cmd+Shift+P → "Reload Window")

#### Issue: Authentication not working locally

**Solution:**
1. Check your `.env.local` file has correct Cognito values
2. Verify client ID is set to: `gllbg66ej476tsaf2ibfjc7g8`
3. Clear browser cookies and try again
4. Check browser console for specific error messages
5. Ensure `NEXT_PUBLIC_API_BASE_URL` points to `https://api.dev.mor.org`

#### Issue: API calls failing

**Solution:**
1. Verify `NEXT_PUBLIC_API_BASE_URL=https://api.dev.mor.org`
2. Check if the API is operational at https://api.dev.mor.org/docs
3. Ensure your API key is valid (create one in the API Keys page)
4. Check browser network tab for error details
5. For payment-related calls, ensure the relevant `COINBASE_COMMERCE_*` or `ADMIN_API_SECRET` vars are set

#### Issue: Build fails with TypeScript errors

**Solution:**
```bash
# Check for TypeScript errors
pnpm exec tsc --noEmit

# Fix type errors in reported files
# Then try building again
pnpm build
```

#### Issue: Hot reload not working

**Solution:**
```bash
# Restart dev server
# Press Ctrl+C to stop, then:
pnpm dev
```

#### Issue: Changes not appearing on app.dev.mor.org

**Solution:**
1. Verify your PR was merged to `dev` branch
2. Check AWS Amplify build status in the AWS console
3. Wait a few minutes for the build and deployment to complete
4. Clear browser cache and refresh
5. Check if there were any build errors in Amplify

#### Issue: Web3 wallet connection not working

**Solution:**
1. Ensure `NEXT_PUBLIC_PROJECT_ID` is set with a valid Reown project ID
2. Get a project ID from https://dashboard.reown.com
3. Clear browser cache and reconnect wallet

#### Issue: Payment flows not working locally

**Solution:**
1. For Coinbase payments, ensure all `COINBASE_COMMERCE_*` variables are set
2. For webhook testing, use a tool like ngrok to expose localhost
3. Ensure `ADMIN_API_SECRET` matches the backend configuration

### Getting Help

If you encounter issues not covered here:

1. **Check Existing Issues**: Search GitHub Issues for similar problems
2. **Search the Codebase**: Look for similar patterns in the code
3. **Ask the Team**: Post in the team Discord channel
4. **Create a GitHub Issue**: If the problem persists, create a detailed issue with:
   - Problem description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/logs if applicable
   - Your environment (OS, Node version, npm version)

---

## Additional Resources

### Documentation
- **Next.js Documentation**: https://nextjs.org/docs
- **React Documentation**: https://react.dev
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Tailwind CSS Docs**: https://tailwindcss.com/docs
- **shadcn/ui Components**: https://ui.shadcn.com/docs
- **TanStack Query (React Query)**: https://tanstack.com/query/latest/docs

### Project Links
- **Dev API Docs**: https://api.dev.mor.org/docs
- **Dev App**: https://app.dev.mor.org
- **Production App**: https://app.mor.org
- **Morpheus Website**: https://mor.org

### Tools & Services
- **AWS Cognito Docs**: https://docs.aws.amazon.com/cognito/
- **AWS Amplify Docs**: https://docs.amplify.aws/
- **Reown AppKit (Web3)**: https://docs.reown.com/appkit/overview
- **Coinbase Commerce**: https://docs.cdp.coinbase.com/commerce-onchain/docs/welcome
- **pnpm Documentation**: https://pnpm.io/

---

## Quick Reference Commands

```bash
# Initial setup
git clone https://github.com/morpheusais/morpheus-marketplace-app.git
cd morpheus-marketplace-app
nvm use                  # Switch to correct Node version (22.x)
pnpm install             # Install dependencies
cp env.example .env.local  # Pre-configured for dev environment

# Development
pnpm dev                 # Start dev server
pnpm lint                # Run linter
pnpm build               # Build for production
pnpm start               # Start production server
pnpm exec tsc --noEmit   # Type check without building

# Git workflow
git checkout dev
git pull origin dev
git checkout -b feature/your-feature
# ... make changes ...
git add .
git commit -m "Add feature: description"
git push origin feature/your-feature
# ... create PR to dev ...
```

---

## Questions?

For questions or clarifications about this guide:
- Open an issue on GitHub
- Ask in the team Discord
- Contact the development team leads

**Happy coding! 🚀**

