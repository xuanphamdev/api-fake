import { NextResponse } from 'next/server';
import { clearSessionCookie } from '../../../../lib/auth';

export async function POST() {
  try {
    clearSessionCookie();
    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
