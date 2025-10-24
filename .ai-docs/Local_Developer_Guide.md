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

- **Node.js**: Version 20.0.0 or higher
  ```bash
  node --version  # Should show v20.0.0 or higher
  ```

- **npm**: Latest version (comes with Node.js)
  ```bash
  npm --version
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
# Install all project dependencies
npm install
```

This will install all required packages listed in `package.json`, including:
- Next.js 15.3.2
- React 18.2.0
- AWS Cognito integration libraries
- Tailwind CSS
- TypeScript and type definitions

### 3. Verify Installation

```bash
# Check that dependencies installed correctly
npm list --depth=0
```

---

## Environment Configuration

### Step 1: Copy Environment Template

```bash
# Copy the example environment file
cp env.example .env.local
```

### Step 2: Configure Environment Variables

Edit `.env.local` with your local development configuration. The `env.example` file is already pre-configured with the correct **dev environment** values:

```env
# =============================================================================
# API Configuration
# =============================================================================
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
NEXT_PUBLIC_ALLOWED_MODEL_TYPES=LLM
NEXT_PUBLIC_DEFAULT_MODEL=LMR-Hermes-3-Llama-3.1-8B
```

### Environment Variable Reference

| Variable | Purpose | Value |
|----------|---------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API endpoint | `https://api.dev.mor.org` |
| `NEXT_PUBLIC_COGNITO_REGION` | AWS region | `us-east-2` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID` | Cognito client | `gllbg66ej476tsaf2ibfjc7g8` |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | Auth domain | `auth.mor.org` |
| `NEXT_PUBLIC_GA_ID` | Google Analytics | Leave empty for dev |
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager | Leave empty for dev |
| `NEXT_PUBLIC_ALLOWED_MODEL_TYPES` | Model filter | `LLM` |
| `NEXT_PUBLIC_DEFAULT_MODEL` | Default model | `LMR-Hermes-3-Llama-3.1-8B` |

> ⚠️ **Important**: The `.env.local` file is gitignored and should NEVER be committed to the repository.

> 💡 **Tip**: Leave `GA_ID` and `GTM_ID` empty during local development to disable analytics tracking.

---

## Local Development

### Starting the Development Server

```bash
# Start the Next.js development server with Turbopack
npm run dev
```

The application will be available at:
- **URL**: http://localhost:3000
- **Hot Reload**: Enabled (changes auto-refresh)
- **Turbopack**: Fast refresh and optimized builds

### Testing Authentication

1. Navigate to http://localhost:3000
2. Click "Login" or "Admin"
3. Sign up for a new account or sign in with existing credentials
4. Create an API key in the Admin dashboard
5. Test the Chat interface

### Testing Features Locally

#### Admin Dashboard
- **URL**: http://localhost:3000/admin
- **Features**: Create/delete API keys, configure automation settings
- **Auth Required**: Yes

#### Chat Interface
- **URL**: http://localhost:3000/chat
- **Features**: Interactive chat, model selection, chat history
- **Auth Required**: Yes (with verified API key)

#### Home Page
- **URL**: http://localhost:3000
- **Features**: Landing page with navigation

### Development Tools

#### ESLint
```bash
# Run linter to check code quality
npm run lint
```

#### TypeScript Type Checking
```bash
# Check types without building
npx tsc --noEmit
```

---

## Building from Source

### Local Production Build

```bash
# Create an optimized production build
npm run build
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
npm run build

# Then start the production server
npm start
```

Access the production build at: http://localhost:3000

> 💡 **Tip**: Always test your changes with a production build before creating a PR to ensure there are no build-time issues.

### Build Verification Checklist

Before submitting a PR:

- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] ESLint passes without errors
- [ ] All pages load correctly
- [ ] Authentication flows work
- [ ] API key management functions properly
- [ ] Chat interface operates as expected

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
├── app/                    # Next.js app directory (routes)
│   ├── admin/             # Admin dashboard
│   ├── chat/              # Chat interface
│   └── auth/              # Auth callbacks
├── components/            # Reusable components
│   ├── auth/             # Auth-specific components
│   └── providers/        # Context providers
└── lib/                  # Utility libraries
    ├── auth/            # Authentication logic
    ├── api/             # API client
    └── utils/           # Helper functions
```

### Best Practices

1. **Component Design**
   - Keep components small and focused
   - Use TypeScript interfaces for props
   - Implement proper error handling
   - Add loading states for async operations

2. **State Management**
   - Use React Context for global state
   - Keep local state minimal
   - Consider using React Query for API data

3. **API Calls**
   - Use the `apiService.ts` helper functions
   - Handle errors gracefully
   - Show user-friendly error messages
   - Implement proper loading indicators

4. **Authentication**
   - Never store sensitive tokens in localStorage
   - Use the CognitoAuth context for auth state
   - Check authentication status before protected operations
   - Handle token expiration gracefully

5. **Security**
   - Never commit credentials or API keys
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
npm run lint

# Test production build
npm run build
npm start
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

#### Issue: `npm install` fails

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

#### Issue: "Cannot find module" errors

**Solution:**
This is usually a TypeScript language server issue:

1. Ensure `node_modules` exists: `npm install`
2. Restart your IDE
3. In VS Code: Reload window (Cmd+Shift+P → "Reload Window")

#### Issue: Authentication not working locally

**Solution:**
1. Check your `.env.local` file has correct Cognito values
2. Verify client ID is set to: `gllbg66ej476tsaf2ibfjc7g8`
3. Clear browser cookies and try again
4. Check browser console for specific error messages

#### Issue: API calls failing

**Solution:**
1. Verify `NEXT_PUBLIC_API_BASE_URL=https://api.dev.mor.org`
2. Check if the API is operational at https://api.dev.mor.org/docs
3. Ensure your API key is valid (create one in the Admin dashboard)
4. Check browser network tab for error details

#### Issue: Build fails with TypeScript errors

**Solution:**
```bash
# Check for TypeScript errors
npx tsc --noEmit

# Fix type errors in reported files
# Then try building again
npm run build
```

#### Issue: Hot reload not working

**Solution:**
```bash
# Restart dev server
# Press Ctrl+C to stop, then:
npm run dev
```

#### Issue: Changes not appearing on app.dev.mor.org

**Solution:**
1. Verify your PR was merged to `dev` branch
2. Check AWS Amplify build status in the AWS console
3. Wait a few minutes for the build and deployment to complete
4. Clear browser cache and refresh
5. Check if there were any build errors in Amplify

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

### Project Links
- **Dev API Docs**: https://api.dev.mor.org/docs
- **Dev App**: https://app.dev.mor.org
- **Morpheus Website**: https://mor.org

### Tools
- **AWS Cognito Docs**: https://docs.aws.amazon.com/cognito/
- **AWS Amplify Docs**: https://docs.amplify.aws/

---

## Quick Reference Commands

```bash
# Initial setup
git clone https://github.com/morpheusais/morpheus-marketplace-app.git
cd morpheus-marketplace-app
npm install
cp env.example .env.local

# Development
npm run dev              # Start dev server
npm run lint             # Run linter
npm run build            # Build for production
npm start                # Start production server

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

