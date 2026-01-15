import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizeNetService } from '@/lib/services';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> | { profileId: string } }
) {
  try {
    // Handle params as either a Promise or direct object (Next.js 16 compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { profileId } = resolvedParams;

    if (!profileId || profileId === 'undefined') {
      return NextResponse.json(
        {
          error: 'Profile ID is required',
          message: 'Please provide a customer profile ID',
        },
        { status: 400 }
      );
    }

    const authorizeNetService = getAuthorizeNetService();

    // Get customer profile and payment profiles in parallel
    const [customerProfileResponse, paymentProfiles] = await Promise.all([
      authorizeNetService.getCustomerProfile(profileId),
      authorizeNetService.getCustomerPaymentProfileList(profileId).catch((error) => {
        console.error('Error fetching payment profiles:', error);
        return [];
      }),
    ]);

    // Extract the profile object and subscriptionIds from the response
    // Response structure: { profile: {...}, subscriptionIds: [...], messages: {...} }
    const customerProfile = customerProfileResponse.profile || customerProfileResponse;
    
    // Extract subscription IDs from the root level of the response
    let subscriptionIds: string[] = [];
    
    // Check for subscriptionIds array at root level (this is where it appears in the API response)
    if (customerProfileResponse.subscriptionIds) {
      if (Array.isArray(customerProfileResponse.subscriptionIds)) {
        subscriptionIds = customerProfileResponse.subscriptionIds.map((id: string | number) => String(id));
      } else if (customerProfileResponse.subscriptionIds.numericString) {
        const ids = customerProfileResponse.subscriptionIds.numericString;
        subscriptionIds = Array.isArray(ids) 
          ? ids.map((id: string | number) => String(id))
          : [String(ids)];
      }
    }
    
    // Also check inside profile object (fallback)
    if (customerProfile.subscriptionIds && subscriptionIds.length === 0) {
      if (Array.isArray(customerProfile.subscriptionIds)) {
        subscriptionIds = customerProfile.subscriptionIds.map((id: string | number) => String(id));
      }
    }
    
    // Check for subscriptions array
    if (customerProfileResponse.subscriptions && Array.isArray(customerProfileResponse.subscriptions)) {
      const subIds = customerProfileResponse.subscriptions
        .map((sub: any) => sub.subscriptionId || sub.id)
        .filter(Boolean)
        .map((id: string | number) => String(id));
      subscriptionIds = [...new Set([...subscriptionIds, ...subIds])];
    }
    
    // Check for subscriptionId (singular)
    if (customerProfileResponse.subscriptionId && !subscriptionIds.includes(String(customerProfileResponse.subscriptionId))) {
      subscriptionIds.push(String(customerProfileResponse.subscriptionId));
    }

    console.log('Extracted subscription IDs:', subscriptionIds);

    // Fetch subscription details for each subscription ID
    const subscriptions = await Promise.all(
      subscriptionIds.map(async (subscriptionId) => {
        try {
          const subscription = await authorizeNetService.getSubscription(subscriptionId);
          return {
            subscriptionId,
            ...subscription,
          };
        } catch (error) {
          console.error(`Error fetching subscription ${subscriptionId}:`, error);
          return {
            subscriptionId,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      customerProfile: {
        profileId,
        ...customerProfile,
      },
      paymentProfiles: paymentProfiles,
      subscriptions: subscriptions,
    });
  } catch (error) {
    console.error('Error getting customer details:', error);
    return NextResponse.json(
      {
        error: 'Failed to get customer details',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
