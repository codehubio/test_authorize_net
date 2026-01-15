import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizeNetService } from '@/lib/services';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, amount } = body;
    const returnUrl = request.headers.get('origin') || request.headers.get('referer') || undefined;

    if (!email) {
      return NextResponse.json(
        {
          error: 'Email is required',
          message: 'Please provide an email address',
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: 'Invalid email format',
          message: 'Please provide a valid email address',
        },
        { status: 400 }
      );
    }

    const authorizeNetService = getAuthorizeNetService();

    // Get or create customer profile
    let profileId: string | undefined;
    let profileCreated = false;
    
    try {
      // Check if profile exists
      const existingProfileId = await authorizeNetService.getCustomerProfileByEmail(email);
      
      if (existingProfileId) {
        profileId = existingProfileId;
        console.log(`Using existing customer profile for ${email}: ${profileId}`);
      } else {
        // Create new profile
        profileId = await authorizeNetService.createCustomerProfile(email);
        profileCreated = true;
        console.log(`Created new customer profile for ${email}: ${profileId}`);
      }
    } catch (error) {
      console.error('Error managing customer profile:', error);
      // If we can't create/get profile, we can't proceed
      return NextResponse.json(
        {
          error: 'Failed to manage customer profile',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    if (!profileId) {
      return NextResponse.json(
        {
          error: 'Failed to get customer profile ID',
          message: 'Customer profile ID is required',
        },
        { status: 500 }
      );
    }

    // Get hosted profile page token (for adding payment method to profile)
    // This is the correct API to use when we have a customer profile
    const token = await authorizeNetService.getHostedProfilePageToken(
      profileId,
      returnUrl
    );

    // Determine if we're using sandbox or production
    const isProduction = process.env.AUTHORIZE_NET_ENV === 'production';
    
    return NextResponse.json({ 
      token,
      profileId,
      profileCreated,
      isSandbox: !isProduction, // Pass environment info to frontend
    });
  } catch (error) {
    console.error('Error getting hosted payment token:', error);
    return NextResponse.json(
      {
        error: 'Failed to get hosted payment token',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
