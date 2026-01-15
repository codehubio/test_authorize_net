import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizeNetService } from '@/lib/services';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      customerProfileId, 
      paymentProfileId,
      subscriptionName,
      amount,
      intervalLength,
      intervalUnit,
      startDate,
      totalOccurrences,
      trialOccurrences,
      trialAmount
    } = body;

    if (!customerProfileId || !paymentProfileId) {
      return NextResponse.json(
        {
          error: 'Customer Profile ID and Payment Profile ID are required',
          message: 'Please provide both customer profile ID and payment profile ID',
        },
        { status: 400 }
      );
    }

    if (!subscriptionName || !amount) {
      return NextResponse.json(
        {
          error: 'Subscription name and amount are required',
          message: 'Please provide subscription name and amount',
        },
        { status: 400 }
      );
    }

    const authorizeNetService = getAuthorizeNetService();

    // Create subscription with provided parameters
    const subscriptionId = await authorizeNetService.createSubscription(
      customerProfileId,
      paymentProfileId,
      subscriptionName,
      amount,
      intervalLength || '1',
      (intervalUnit as 'days' | 'months') || 'months',
      startDate,
      totalOccurrences || '12',
      trialOccurrences || '0',
      trialAmount || '0.00',
      undefined
    );

    return NextResponse.json({
      success: true,
      message: 'Subscription created successfully',
      subscriptionId: subscriptionId,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      {
        error: 'Failed to create subscription',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
