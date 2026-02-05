import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.mor.org';
const API_VERSION = '/api/v1';

function buildTargetUrl(path: string[], search: string): string {
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const joinedPath = path.length ? `/${path.join('/')}` : '';
  return `${baseUrl}${API_VERSION}/billing${joinedPath}${search}`;
}

function buildForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const authorization = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');
  const requestedWith = request.headers.get('x-requested-with');

  if (contentType) headers.set('content-type', contentType);
  if (authorization) headers.set('authorization', authorization);
  if (apiKey) headers.set('x-api-key', apiKey);
  if (requestedWith) headers.set('x-requested-with', requestedWith);

  return headers;
}

async function proxyBillingRequest(request: NextRequest, path: string[]) {
  const targetUrl = buildTargetUrl(path, request.nextUrl.search);
  const headers = buildForwardHeaders(request);
  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.text();
    if (body) {
      init.body = body;
    }
  }

  const response = await fetch(targetUrl, init);
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyBillingRequest(request, params.path ?? []);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyBillingRequest(request, params.path ?? []);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyBillingRequest(request, params.path ?? []);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyBillingRequest(request, params.path ?? []);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyBillingRequest(request, params.path ?? []);
}
