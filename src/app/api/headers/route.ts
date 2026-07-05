export const dynamic = 'force-dynamic';

// Temporary debug endpoint to echo request headers.
// Remove this file after verification.
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const headersObj: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  return NextResponse.json(headersObj);
}
