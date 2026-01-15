import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizeNetService } from '@/lib/services';

export async function GET(request: NextRequest) {
  try {
    const authorizeNetService = getAuthorizeNetService();

    // Get all customer profile IDs
    const profileIds = await authorizeNetService.getCustomerProfileIds();

    // Fetch full details for each customer profile
    const customers = await Promise.all(
      profileIds.map(async (profileId) => {
        try {
          const profile = await authorizeNetService.getCustomerProfile(profileId);
          return {
            profileId,
            ...profile,
          };
        } catch (error) {
          console.error(`Error fetching profile ${profileId}:`, error);
          // Return basic info if full profile fetch fails
          return {
            profileId,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      count: customers.length,
      customers: customers,
    });
  } catch (error) {
    console.error('Error getting customer list:', error);
    return NextResponse.json(
      {
        error: 'Failed to get customer list',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
