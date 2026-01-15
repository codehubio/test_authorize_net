import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizeNetService } from '@/lib/services';

export async function GET(
  request: NextRequest,
  { params }: { params: { profileId: string } }
) {
  try {
    const { profileId } = params;

    if (!profileId) {
      return NextResponse.json(
        {
          error: 'Profile ID is required',
          message: 'Please provide a customer profile ID',
        },
        { status: 400 }
      );
    }

    const authorizeNetService = getAuthorizeNetService();
    const paymentProfiles = await authorizeNetService.getCustomerPaymentProfileList(profileId);

    return NextResponse.json({
      success: true,
      paymentProfiles: paymentProfiles,
    });
  } catch (error) {
    console.error('Error getting payment profiles:', error);
    return NextResponse.json(
      {
        error: 'Failed to get payment profiles',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
