import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizeNetService } from '@/lib/services';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerProfileId } = body;
    const returnUrl = request.headers.get('origin') || request.headers.get('referer') || undefined;

    if (!customerProfileId) {
      return NextResponse.json(
        {
          error: 'Customer Profile ID is required',
          message: 'Please provide a customer profile ID',
        },
        { status: 400 }
      );
    }

    const authorizeNetService = getAuthorizeNetService();

    // Get hosted profile page token (for editing payment method)
    const token = await authorizeNetService.getHostedProfilePageToken(
      customerProfileId,
      returnUrl
    );

    // Determine if we're using sandbox or production
    const isProduction = process.env.AUTHORIZE_NET_ENV === 'production';
    
    return NextResponse.json({ 
      token,
      isSandbox: !isProduction, // Pass environment info to frontend
    });
  } catch (error) {
    console.error('Error getting hosted payment token for editing:', error);
    return NextResponse.json(
      {
        error: 'Failed to get hosted payment token',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
