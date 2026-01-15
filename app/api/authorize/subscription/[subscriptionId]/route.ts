import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizeNetService } from '@/lib/services';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> | { subscriptionId: string } }
) {
  try {
    // Handle params as either a Promise or direct object (Next.js 16 compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { subscriptionId } = resolvedParams;

    if (!subscriptionId || subscriptionId === 'undefined') {
      return NextResponse.json(
        {
          error: 'Subscription ID is required',
          message: 'Please provide a subscription ID',
        },
        { status: 400 }
      );
    }

    const authorizeNetService = getAuthorizeNetService();
    await authorizeNetService.cancelSubscription(subscriptionId);

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel subscription',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
