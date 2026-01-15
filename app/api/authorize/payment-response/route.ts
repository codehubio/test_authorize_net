import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Payment response received:', body);
    // Handle payment response here
    // You can redirect to a success page or return JSON
    return NextResponse.json({ success: true, message: 'Payment processed' });
  } catch (error) {
    console.error('Error handling payment response:', error);
    return NextResponse.json(
      {
        error: 'Failed to handle payment response',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
