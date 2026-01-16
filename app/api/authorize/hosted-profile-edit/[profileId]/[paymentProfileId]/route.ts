import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizeNetService } from '@/lib/services';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string; paymentProfileId: string }> | { profileId: string; paymentProfileId: string } }
) {
  try {
    // Handle params as either a Promise or direct object (Next.js 16 compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { profileId, paymentProfileId } = resolvedParams;

    if (!profileId || !paymentProfileId || profileId === 'undefined' || paymentProfileId === 'undefined') {
      return NextResponse.json(
        {
          error: 'Profile ID and Payment Profile ID are required',
          message: 'Please provide both customer profile ID and payment profile ID',
        },
        { status: 400 }
      );
    }

    const authorizeNetService = getAuthorizeNetService();
    const returnUrl = request.headers.get('origin') || request.headers.get('referer') || undefined;

    // Get hosted profile page token for editing payment profile
    const token = await authorizeNetService.getHostedProfilePageToken(
      profileId,
      returnUrl
    );

    // Determine if we're using sandbox or production
    const isProduction = process.env.AUTHORIZE_NET_ENV === 'production';
    const formUrl = isProduction
      ? 'https://accept.authorize.net/customer/editPayment'
      : 'https://test.authorize.net/customer/editPayment';
    
    return NextResponse.json({ 
      token,
      formUrl,
      paymentProfileId,
      isSandbox: !isProduction,
    });
  } catch (error) {
    console.error('Error getting hosted profile token for editing:', error);
    return NextResponse.json(
      {
        error: 'Failed to get hosted profile token',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
