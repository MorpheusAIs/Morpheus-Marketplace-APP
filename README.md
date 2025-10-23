# Morpheus APP Documentation

This is a [Next.js](https://nextjs.org) project that provides documentation and management interface for the Morpheus API Gateway. The application includes user authentication, API key management, automation settings, and comprehensive documentation.

## Features

- 🔐 **User Authentication**: Secure login and registration system
- 🔑 **API Key Management**: Create and manage API keys
- ⚙️ **Automation Settings**: Configure automated behaviors
- 💬 **Chat Interface**: Test API functionality (coming soon)

## Environment Setup

Create a `.env` file in the root directory with the following variables:
```env
# Database
DATABASE_URL="your_postgresql_connection_string"

# Google Analytics 4
NEXT_PUBLIC_GA_ID="G-XXXXXXXXXX"

# Google Tag Manager
NEXT_PUBLIC_GTM_ID="GTM-XXXXXXX"
```

## Getting Started

First, install dependencies:

```bash
npm install
```

Set up the database:

```bash
npm run db:setup
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Analytics Integration

This project includes both Google Analytics 4 and Google Tag Manager for comprehensive tracking:

### Google Analytics 4 (GA4)
- **Direct analytics tracking** for immediate data collection
- **Measurement ID**: `G-MSQ0EV24TS`
- **Real-time reporting** and detailed user analytics

### Google Tag Manager (GTM)
- **Centralized tag management** for multiple marketing tools
- **Container ID**: `GTM-MZQW3K5`
- **Advanced tag configurations** and trigger management

### Key Features:
- **Multi-channel event sending**: Events are sent to both GA4 and GTM simultaneously
- **Automatic page view tracking** when users navigate between routes
- **Custom event tracking** for all major user interactions
- **Type-safe event system** with predefined event types
- **Error handling** to prevent tracking failures from affecting UX
- **Environment variable configuration** for security

### Tracked Events:
- User authentication events (login, register, logout)
- API key management tracking (creation, deletion)
- Automation settings tracking (enable/disable)
- Documentation page views
- Chat message interactions
- Custom button clicks and form submissions

### Testing Analytics:

1. **Network Tab Testing**:
   - Open browser DevTools → Network tab
   - Filter by "gtag" to see GA4 requests
   - Filter by "googletagmanager" to see GTM requests

2. **Real-time Testing**:
   - Use Google Analytics Real-time reports for GA4 data
   - Use GTM Preview mode for tag debugging

3. **Browser Extensions**:
   - Google Analytics Debugger for GA4
   - Google Tag Assistant for GTM

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on AWS Amplify

This application is deployed using AWS Amplify for seamless integration with AWS services.

**Important**: Remember to set both `NEXT_PUBLIC_GA_ID` and `NEXT_PUBLIC_GTM_ID` environment variables in your Amplify deployment settings for analytics to work in production.

Check out the [AWS Amplify documentation](https://docs.amplify.aws/) for more deployment details.
