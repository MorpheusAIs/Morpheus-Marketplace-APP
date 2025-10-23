'use client';

import React from 'react';
import Link from 'next/link';
import { DOC_URLS } from '@/lib/api/config';

export default function WhatIsApiGatewayPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-[var(--platinum)]">
      <h1 className="text-3xl font-bold text-[var(--neon-mint)] mb-6">
        API Gateway Open Beta Program
      </h1>
      
      <div className="space-y-8">
        {/* Introduction Section */}
        <div className="bg-[var(--eclipse)] p-6 rounded-lg shadow-md border-2 border-[var(--emerald)]/30">
          <p className="text-lg">
            Welcome to the Morpheus API Gateway Open Beta Program. We appreciate you spending the time to help us test, and hope that you are as excited as we are for this new addition to the Morpheus Ecosystem.
          </p>
        </div>

        {/* What is this about Section */}
        <div className="bg-[var(--eclipse)] p-6 rounded-lg shadow-md border-2 border-[var(--emerald)]/30">
          <h2 className="text-2xl font-semibold text-[var(--neon-mint)] mb-4">What is the Morpheus Compute Router?</h2>
          
          <p className="text-lg mb-4">
            We're making it easy for you to use the Morpheus Compute router access LLM inference. The Morpheus Compute router was designed so that users could create "sessions" with LLM providers, essentially renting their compute hardware to send prompts to their hosted model.
          </p>

          <h3 className="text-xl font-medium text-[var(--neon-mint)] mb-3">Opening a Session</h3>
          <p className="text-lg mb-2">
            To open a "session" in the Morpheus Compute Marketplace, users have 2 choices:
          </p>

          <ul className="list-disc list-inside space-y-2 text-lg mb-4 ml-4">
            <li><strong className="text-[var(--platinum)]">Pay Directly with MOR:</strong> Spend MOR tokens to achieve a 1:1 payment ratio for the session.</li>
            <li><strong className="text-[var(--platinum)]">Stake MOR:</strong> Stake MOR tokens to utilize your daily allowance of compute inference. Staking provides a daily allocation of credits that can be used for opening sessions. Your daily credits are determined by your amount of staked MOR token (credit calculator for testing purposes only currently on <a href="http://calc.kyletest.com" className="text-[var(--neon-mint)] hover:text-[var(--emerald)] font-medium">calc.kyletest.com</a>, which will be transitioned).</li>
          </ul>
        </div>

        {/* What is the API Gateway Section */}
        <div className="bg-[var(--eclipse)] p-6 rounded-lg shadow-md border-2 border-[var(--emerald)]/30">
          <h2 className="text-2xl font-semibold text-[var(--neon-mint)] mb-4">What is the API Gateway?</h2>
          
          <p className="text-lg mb-4">
            Before today, you've needed to host your own proxy-router in order to interact with the system, which is burdensome for most application. This new API gateway takes care of those interactions on your behalf, allowing you to access the compute marketplace with just an API key (created through the API portal). The API gateway simplifies session management by providing an automated workflow to create sessions when you need them, identifying the highest rated provider for your model of choice.
          </p>

          <p className="text-lg mb-4">
            This Open-beta program is currently utilizing a wallet that contains staked MOR. You will not be connecting your wallet or staking MOR directly. We will be implementing this functionality in the future when we move to a GA release.
          </p>

          <div className="bg-[var(--matrix-green)] border-l-4 border-[var(--neon-mint)] p-4">
            <p className="text-[var(--platinum)] text-xl font-bold mb-4">
              The Morpheus API Gateway is a way for users to access AI inference for FREE. There is no cost. Login, grab an API key, and you are ready to go.
            </p>
            <p className="text-[var(--platinum)] text-xl font-bold text-center">
              FREE AI FOR ALL -- until you break it, or until we go broke.
            </p>
          </div>
        </div>

        {/* Getting Started Section */}
        <div className="bg-[var(--eclipse)] p-6 rounded-lg shadow-md border-2 border-[var(--emerald)]/30">
          <h2 className="text-2xl font-semibold text-[var(--neon-mint)] mb-4">Getting Started</h2>

          <p className="text-lg mb-2">The steps are simple:</p>
          <ol className="list-decimal list-inside space-y-2 text-lg mb-6 ml-4">
            <li>Create an account and Login</li>
            <li>Create an API key and enable automation</li>
            <li>Chat with your model of choice through the Morpheus Compute Marketplace</li>
          </ol>

          <div className="bg-[var(--matrix-green)] border-l-4 border-[var(--neon-mint)] p-4 space-y-2">
            <p className="text-[var(--platinum)] font-medium">
              <strong>API Gateway Base URL:</strong> <code className="bg-[var(--midnight)] px-2 py-1 rounded">{DOC_URLS.baseAPI()}</code>
            </p>
            <p className="text-[var(--platinum)] font-medium">
              <strong>API Gateway Swagger UI:</strong> <a href={DOC_URLS.swaggerUI()} className="text-[var(--neon-mint)] hover:text-[var(--emerald)]">{DOC_URLS.swaggerUI()}</a>
            </p>
            <p className="text-[var(--platinum)] font-medium">
              <strong>Postman Collection:</strong> <a href="https://www.postman.com/bluefin-6568608/morpheus-api/collection/7ll8i2s/api-documentation?action=share&creator=44737384" className="text-[var(--neon-mint)] hover:text-[var(--emerald)]">View Collection</a>
            </p>
          </div>
        </div>

        {/* Testing and Feedback Section */}
        <div className="bg-[var(--eclipse)] p-6 rounded-lg shadow-md border-2 border-[var(--emerald)]/30">
          <h2 className="text-2xl font-semibold text-[var(--neon-mint)] mb-4">What We're Looking For</h2>

          <p className="text-lg mb-4">
            Use the docs within this repository to learn more about the API Gateway and how to use it.
          </p>

          <p className="text-lg mb-4">
            We want you to pressure test the API gateway and provide as much feedback as possible. Create an API and sends prompts through whatever method you currently use. Use your API key and Base URL to connect to coding IDEs like "Cursor", or use with "Roo Code" or any other VS Code plugins. Connect to browsers like Brave with Brave Leo, or integrate with custom Chat UIs like OpenWebUI. Use the API to power your agents, or plug into any other application you choose.
          </p>

          <p className="text-lg mb-4">
            With our first stable release we'd like to know what you love, what you hate, what broke, and what you'd like improved. We are asking for you to beat this up and be picky - your feedback will drive the improvements before this goes to the broader market.
          </p>

          <div className="bg-[var(--matrix-green)] border-l-4 border-[var(--neon-mint)] p-4">
            <p className="text-[var(--platinum)] font-medium">
              <strong>Provide Feedback:</strong> Use the google doc <a href="https://docs.google.com/spreadsheets/d/1Fj_AsxBWVFHhjD5neDeaKBnL64dVJ1S0GJQ9tKjZBz0/edit?usp=sharing" className="text-[var(--neon-mint)] hover:text-[var(--emerald)]">here</a> to provide feedback.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 