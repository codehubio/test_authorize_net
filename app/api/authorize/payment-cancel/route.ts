import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Payment cancelled:', body);
    return NextResponse.json({ cancelled: true, message: 'Payment cancelled' });
  } catch (error) {
    console.error('Error handling payment cancel:', error);
    return NextResponse.json(
      {
        error: 'Failed to handle payment cancel',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
