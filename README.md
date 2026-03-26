# Morpheus APP - Morpheus Inference API Interface

A [Next.js](https://nextjs.org) application that provides the user interface for the Morpheus Inference API, including user authentication via AWS Cognito, API key management, automation settings, and an interactive chat interface.

## 🚀 Features

- 🔐 **AWS Cognito Authentication**: Secure OAuth2/OpenID Connect authentication
- 🔑 **API Key Management**: Create, manage, and delete API keys
- ⚙️ **Automation Settings**: Configure automated session management
- 💬 **Interactive Chat**: Real-time chat interface with model selection and history
- 📊 **Analytics Integration**: Google Analytics 4 and Google Tag Manager support
- 🎨 **Modern UI**: Beautiful, responsive design with Tailwind CSS

## 📋 Prerequisites

- **Node.js**: >= 20.0.0 (specified in package.json engines)
- **npm**: Latest version recommended
- **AWS Cognito**: Access to the Morpheus Cognito User Pool credentials

## 🛠️ Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/morpheusais/morpheus-marketplace-app.git
cd morpheus-marketplace-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and configure it for your local environment:

```bash
cp env.example .env.local
```

Edit `.env.local` with your configuration. The `env.example` file is pre-configured with production environment values:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.mor.org
NEXT_PUBLIC_COGNITO_REGION=us-east-2
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=gllbg66ej476tsaf2ibfjc7g8
NEXT_PUBLIC_COGNITO_DOMAIN=auth.mor.org
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_GTM_ID=
NEXT_PUBLIC_ALLOWED_MODEL_TYPES=LLM
NEXT_PUBLIC_DEFAULT_MODEL=LMR-Hermes-3-Llama-3.1-8B
```

> 💡 **Tip**: Analytics tracking is disabled by default (GA_ID and GTM_ID are empty).

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### 5. Build for Production

```bash
npm run build
npm start
```

## 📖 Documentation

For detailed developer documentation, see:
- **[Local Developer Guide](./.ai-docs/Local_Developer_Guide.md)** - Complete setup and contribution guidelines

## 🏗️ Project Structure

```
morpheus-marketplace-app/
├── src/
│   ├── app/                    # Next.js app directory (routes)
│   │   ├── admin/             # Admin dashboard for API key management
│   │   ├── account/           # User account settings
│   │   ├── api-keys/          # API key management page
│   │   ├── auth/              # Authentication callbacks
│   │   ├── chat/              # Interactive chat interface
│   │   ├── confirm-registration/  # Email verification
│   │   ├── login-direct/      # Direct login page
│   │   ├── register/          # Registration page
│   │   ├── signin/            # Sign in page
│   │   ├── signup/            # Sign up page
│   │   ├── test/              # Test page
│   │   └── ...                # Root layout, globals, etc.
│   ├── components/            # Reusable React components
│   │   ├── ai-elements/      # AI chat components (messages, prompts, etc.)
│   │   ├── auth/             # Authentication components
│   │   ├── providers/        # Context providers (GTM, etc.)
│   │   ├── ui/               # shadcn/ui components
│   │   └── ...               # Other shared components
│   ├── lib/                  # Utility libraries
│   │   ├── api/             # API service layer
│   │   ├── auth/            # Cognito authentication logic
│   │   ├── hooks/           # Custom React hooks
│   │   ├── types/           # TypeScript type definitions
│   │   └── utils/           # Helper functions
│   └── types/               # Global type definitions
├── docs/                     # Developer documentation
├── public/                   # Static assets
├── amplify.yml              # AWS Amplify build configuration
├── components.json          # shadcn/ui configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── ...                      # Other config files
```

## 🔧 Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🌐 Deployment

This application is deployed using **AWS Amplify** with automatic deployments configured for:

- **Development**: `https://app.dev.mor.org` (from `dev` branch)
- **Production**: `https://app.mor.org` (from `main` branch)

### Branch Workflow

- Feature branches → PR to `dev` (1 peer review required)
- `dev` → Automatically deploys to `https://app.dev.mor.org`
- `dev` → PR to `main` (2 peer reviews required)
- `main` → Automatically deploys to `https://app.mor.org`

## 📊 Analytics Integration

### Google Analytics 4 (GA4)
- **Measurement ID**: `G-RQ88CWRH3X`
- Real-time user analytics and behavior tracking

### Google Tag Manager (GTM)
- **Container ID**: `GTM-5SNC6HZ5`
- Centralized tag management and advanced configurations

### Tracked Events
- User authentication (login, signup, logout)
- API key management (create, delete, set default)
- Automation settings changes
- Chat message interactions
- Page views and navigation

## 🔐 Authentication

This application uses **AWS Cognito** for authentication with:
- Direct sign-in/sign-up flows
- Password reset functionality
- OAuth2/OpenID Connect tokens
- Secure session management

Authentication is configured through environment variables (see `env.example`).

## 🤝 Contributing

Please see the [Local Developer Guide](./.ai-docs/Local_Developer_Guide.md) for contribution guidelines and development workflow.

## 📝 License

This project is part of the Morpheus AI ecosystem.

## 🔗 Related Resources

- [Morpheus API Documentation](https://api.mor.org/docs)
- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [Next.js Documentation](https://nextjs.org/docs)
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)

## 💬 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Join the Morpheus community on Discord
- Visit [mor.org](https://mor.org) for more information
