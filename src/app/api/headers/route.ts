export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// Endpoint intentionally disabled. This route previously echoed request headers
// for debugging and has been removed. Returning 404 to match original repository behavior.
export async function GET() {
  return new NextResponse(null, { status: 404 });
}
