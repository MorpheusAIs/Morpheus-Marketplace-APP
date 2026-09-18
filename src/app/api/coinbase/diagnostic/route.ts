import { NextResponse } from 'next/server';

/**
 * F-12: Diagnostic endpoint disabled for security
 * Previously returned configuration status. Now returns 404 for safety.
 * File preserved for route structure but endpoint is non-functional.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Not found' },
    { status: 404 }
  );
}
