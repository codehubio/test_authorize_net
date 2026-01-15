import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Profile return received:', body);
    // Handle profile return here
    // The payment profile has been added to the customer profile
    // You can redirect to a success page or return JSON
    return NextResponse.json({ success: true, message: 'Payment profile added successfully' });
  } catch (error) {
    console.error('Error handling profile return:', error);
    return NextResponse.json(
      {
        error: 'Failed to handle profile return',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
