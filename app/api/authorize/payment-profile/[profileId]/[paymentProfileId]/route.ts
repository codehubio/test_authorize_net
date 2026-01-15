import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizeNetService } from '@/lib/services';

export async function DELETE(
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
    await authorizeNetService.deleteCustomerPaymentProfile(profileId, paymentProfileId);

    return NextResponse.json({
      success: true,
      message: 'Payment profile deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting payment profile:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete payment profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
