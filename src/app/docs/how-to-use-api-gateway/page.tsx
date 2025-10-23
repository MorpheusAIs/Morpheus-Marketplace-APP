'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { DOC_URLS } from '@/lib/api/config';
import YouTubeEmbed from '../../components/YouTubeEmbed';

export default function HowToUseAPIGateway() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-[var(--platinum)]">
      <h1 className="text-3xl font-bold text-[var(--platinum)] mb-6">
        How To Use the API Gateway
      </h1>
      
      <YouTubeEmbed videoId="YotBHIAjmXk" title="How to Use API Gateway Tutorial" />
      
      <p className="text-lg mb-6">
        Using the Morpheus API is truly simple. The structure of this gateway allows you to access the Morpheus Compute Marketplace just as you would with any other AI Provider (like OpenAI).
      </p>

      <div className="space-y-12">
        <div className="bg-[var(--eclipse)] p-6 rounded-lg shadow-md border-2 border-[var(--emerald)]/30">
          <h3 className="text-xl font-medium text-[var(--platinum)] mb-3">
            Step 1: Sign Up or Login
          </h3>
          <p className="text-lg mb-4">
            First, head over to <Link href="/admin" className="text-[var(--neon-mint)] hover:text-[var(--emerald)] font-medium">the admin page</Link> and sign up or login to your account
          </p>
          <div className="relative h-80 w-full border-2 border-[var(--emerald)]/30 rounded-lg overflow-hidden mb-4 bg-[var(--eclipse)]">
            <Image 
              src="/images/startup/login.png"
              alt="Login Page"
              fill
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>

        <div className="bg-[var(--eclipse)] p-6 rounded-lg shadow-md border-2 border-[var(--emerald)]/30">
          <h3 className="text-xl font-medium text-[var(--platinum)] mb-3">
            Step 2: Access Admin Dashboard
          </h3>
          <p className="text-lg mb-4">
            Then, you will be brought to your admin dashboard where you can manage your API Keys or configure your automation
          </p>
          <div className="relative h-80 w-full border-2 border-[var(--emerald)]/30 rounded-lg overflow-hidden mb-4 bg-[var(--eclipse)]">
            <Image 
              src="/images/startup/manage.png"
              alt="Admin Dashboard"
              fill
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>

        <div className="bg-[var(--eclipse)] p-6 rounded-lg shadow-md border-2 border-[var(--emerald)]/30">
          <h3 className="text-xl font-medium text-[var(--platinum)] mb-3">
            Step 3: Create API Key
          </h3>
          <p className="text-lg mb-4">
            Next, create your first API Key by naming your key and clicking "Create Key". A new box will appear with your API key. Make sure you copy this down.
          </p>
          <div className="relative h-80 w-full border-2 border-[var(--emerald)]/30 rounded-lg overflow-hidden mb-4 bg-[var(--eclipse)]">
            <Image 
              src="/images/startup/apikey.png"
              alt="API Key Creation"
              fill
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>

        <div className="bg-[var(--eclipse)] p-6 rounded-lg shadow-md border-2 border-[var(--emerald)]/30">
          <h3 className="text-xl font-medium text-[var(--platinum)] mb-3">
            Step 4: Configure Automation
          </h3>
          <p className="text-lg mb-4">
            Then, enter the API key into the Automation settings tab to configure automatic session generation. This removes the need to create sessions with individual providers hosting your model of choice.
          </p>
          <div className="relative h-80 w-full border-2 border-[var(--emerald)]/30 rounded-lg overflow-hidden mb-4 bg-[var(--eclipse)]">
            <Image 
              src="/images/startup/automation.png"
              alt="Automation Configuration"
              fill
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>

        <div className="bg-[var(--eclipse)] p-6 rounded-lg shadow-md border-2 border-[var(--emerald)]/30">
          <h3 className="text-xl font-medium text-[var(--platinum)] mb-3">
            Step 5: Start Testing
          </h3>
          <p className="text-lg mb-4">
            Now you're ready to go! You can head over to <Link href="/test" className="text-[var(--neon-mint)] hover:text-[var(--emerald)] font-medium">the test page</Link> to begin some test chats with your API key
          </p>
          <div className="relative h-80 w-full border-2 border-[var(--emerald)]/30 rounded-lg overflow-hidden mb-4 bg-[var(--eclipse)]">
            <Image 
              src="/images/startup/chat.png"
              alt="Test Chat Interface"
              fill
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>

        <div className="bg-[var(--eclipse)] p-6 rounded-lg shadow-md border-2 border-[var(--emerald)]/30">
          <h3 className="text-xl font-medium text-[var(--platinum)] mb-3">
            Ready to Use!
          </h3>
          <p className="text-lg mb-4">
            Now you can begin using the Morpheus Compute Node through the API Gateway! For integrations, use the following information:
          </p>
          <div className="bg-[var(--eclipse)] border-l-4 border-[var(--emerald)]/30 p-4 mb-4">
            <p className="text-[var(--platinum)] font-medium">
              <strong>Base URL:</strong> {DOC_URLS.baseAPI()}
            </p>
            <p className="text-[var(--platinum)] font-medium">
              <strong>API Key:</strong> [Your API key]
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 