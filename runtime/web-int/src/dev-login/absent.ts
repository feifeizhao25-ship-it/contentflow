import { NextRequest, NextResponse } from 'next/server';

/** Production entry: there is no test login. Every request is a 404. */
export function POST(_request: NextRequest) {
  return new NextResponse(null, { status: 404 });
}
