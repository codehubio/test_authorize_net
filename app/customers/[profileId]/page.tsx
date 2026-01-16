'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SubscriptionList from './components/SubscriptionList';
import PaymentProfileList from './components/PaymentProfileList';

interface CustomerProfile {
  profileId: string;
  merchantCustomerId?: string;
  email?: string;
  description?: string;
}

interface PaymentProfile {
  customerPaymentProfileId?: string;
  paymentProfileId?: string;
  billTo?: {
    firstName?: string;
    lastName?: string;
    company?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    phoneNumber?: string;
    faxNumber?: string;
  };
  payment?: {
    creditCard?: {
      cardNumber?: string;
      expirationDate?: string;
      cardType?: string;
    };
    bankAccount?: {
      accountType?: string;
      routingNumber?: string;
      accountNumber?: string;
      nameOnAccount?: string;
    };
  };
  defaultPaymentProfile?: boolean;
}

interface Subscription {
  subscriptionId: string;
  name?: string;
  status?: string;
  amount?: string | number;
  trialAmount?: string | number;
  paymentSchedule?: {
    interval?: {
      length?: string | number;
      unit?: string;
    };
    startDate?: string;
    totalOccurrences?: string | number;
    trialOccurrences?: string | number;
  };
  profile?: {
    customerProfileId?: string;
    customerPaymentProfileId?: string;
    paymentProfile?: {
      customerPaymentProfileId?: string;
    };
  };
  error?: string;
}

interface CustomerDetails {
  customerProfile: CustomerProfile;
  paymentProfiles: PaymentProfile[];
  subscriptions?: Subscription[];
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const profileId = params?.profileId as string | undefined;

  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [cancelingSubscriptionId, setCancelingSubscriptionId] = useState<string | null>(null);
  const [creatingSubscriptionId, setCreatingSubscriptionId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [addPaymentToken, setAddPaymentToken] = useState<string | null>(null);
  const [addPaymentFormUrl, setAddPaymentFormUrl] = useState<string | null>(null);

  useEffect(() => {
    // Wait for params to be available
    if (!params) {
      setLoading(false);
      setError('Profile ID not found in URL');
      return;
    }

    const id = params.profileId as string | undefined;
    if (!id || id === 'undefined') {
      setLoading(false);
      setError('Invalid profile ID');
      return;
    }

    fetchCustomerDetails(id);

    // Check if we're returning from hosted form edit
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('edited') === 'true') {
      // Refresh data after edit
      setTimeout(() => {
        fetchCustomerDetails(id);
        // Remove the query parameter from URL
        window.history.replaceState({}, '', window.location.pathname);
      }, 500);
    }
  }, [params]);

  const fetchCustomerDetails = async (id: string) => {
    if (!id || id === 'undefined') {
      setError('Invalid profile ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/authorize/customers/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch customer details');
      }

      setCustomerDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching customer details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePaymentProfile = async (paymentProfileId: string) => {
    if (!profileId || !customerDetails) return;

    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete payment profile ${paymentProfileId}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingProfileId(paymentProfileId);
      const response = await fetch(
        `/api/authorize/payment-profile/${profileId}/${paymentProfileId}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete payment profile');
      }

      // Refresh customer details after successful deletion
      await fetchCustomerDetails(profileId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete payment profile');
      console.error('Error deleting payment profile:', err);
    } finally {
      setDeletingProfileId(null);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!customerDetails) return;

    // Confirm cancellation
    const confirmed = window.confirm(
      `Are you sure you want to cancel subscription ${subscriptionId}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setCancelingSubscriptionId(subscriptionId);
      const response = await fetch(`/api/authorize/subscription/${subscriptionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to cancel subscription');
      }

      // Refresh customer details after successful cancellation
      if (profileId) {
        await fetchCustomerDetails(profileId);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel subscription');
      console.error('Error canceling subscription:', err);
    } finally {
      setCancelingSubscriptionId(null);
    }
  };

  const handleCreateSubscription = async (paymentProfileId: string, subscriptionData: any) => {
    if (!profileId || !customerDetails) return;

    try {
      setCreatingSubscriptionId(paymentProfileId);
      const response = await fetch('/api/authorize/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerProfileId: profileId,
          paymentProfileId: paymentProfileId,
          ...subscriptionData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create subscription');
      }

      // Refresh customer details after successful creation
      await fetchCustomerDetails(profileId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create subscription');
      console.error('Error creating subscription:', err);
    } finally {
      setCreatingSubscriptionId(null);
    }
  };

  const handleEditPaymentProfile = async (paymentProfileId: string, profileData: PaymentProfile) => {
    // This function is called when the hosted form is opened
    // The actual editing happens in the Authorize.net hosted form
    // After the user completes editing, they'll be redirected back
    // We can refresh the page data when they return
    if (!profileId) return;
    
    // The hosted form will handle the editing
    // We just need to refresh the data when the user returns
    // This could be done via a callback URL or by checking window focus
    window.addEventListener('focus', () => {
      // Refresh data when window regains focus (user returns from hosted form)
      fetchCustomerDetails(profileId);
    }, { once: true });
  };

  const handleAddPaymentProfile = async () => {
    if (!profileId) return;

    try {
      // Get token for hosted form
      const response = await fetch(`/api/authorize/hosted-profile-add/${profileId}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get add payment form token');
      }

      // Store token and form URL for iframe
      setAddPaymentToken(data.token);
      setAddPaymentFormUrl(data.formUrl);
      setShowAddPaymentModal(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to open add payment form');
      console.error('Error opening add payment form:', err);
    }
  };

  const handleCloseAddPaymentModal = () => {
    setShowAddPaymentModal(false);
    setAddPaymentFormUrl(null);
    setAddPaymentToken(null);
    // Refresh the page data after closing (in case a payment profile was added)
    if (profileId) {
      fetchCustomerDetails(profileId);
    }
  };

  const addPaymentIframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-submit form to iframe when modal opens
  useEffect(() => {
    if (showAddPaymentModal && addPaymentToken && addPaymentFormUrl) {
      // Wait for iframe to be rendered, then submit form
      const timer = setTimeout(() => {
        const form = document.getElementById('addPaymentForm') as HTMLFormElement;
        if (form) {
          form.submit();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showAddPaymentModal, addPaymentToken, addPaymentFormUrl]);


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg">Loading customer details...</div>
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg bg-red-50 p-6 text-center">
          <h2 className="mb-2 text-xl font-semibold text-red-800">Error</h2>
          <p className="text-red-600">{error}</p>
          <div className="mt-4 space-x-4">
            <button
              onClick={() => profileId && fetchCustomerDetails(profileId)}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Retry
            </button>
            <Link
              href="/customers"
              className="inline-block rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
            >
              Back to Customers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!customerDetails) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg bg-yellow-50 p-6 text-center">
          <h2 className="mb-2 text-xl font-semibold text-yellow-800">No Data</h2>
          <p className="text-yellow-600">Customer details not found.</p>
          <Link
            href="/customers"
            className="mt-4 inline-block rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  const { customerProfile, paymentProfiles } = customerDetails;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/customers"
            className="mb-4 inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Customers
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Customer Details</h1>
              <p className="mt-2 text-sm text-gray-500">Profile ID: {customerProfile.profileId}</p>
            </div>
            <button
              onClick={() => profileId && fetchCustomerDetails(profileId)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Customer Profile Section */}
        <div className="mb-8 overflow-hidden rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Customer Profile</h2>
              <button
                onClick={handleAddPaymentProfile}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                title="Add new payment profile"
              >
                + Add Payment Profile
              </button>
            </div>
          </div>
          <div className="px-6 py-4">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Profile ID</dt>
                <dd className="mt-1 text-sm font-mono text-gray-900">
                  {customerProfile.profileId}
                </dd>
              </div>
              {customerProfile.merchantCustomerId && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Merchant Customer ID</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {customerProfile.merchantCustomerId}
                  </dd>
                </div>
              )}
              {customerProfile.email && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{customerProfile.email}</dd>
                </div>
              )}
              {customerProfile.description && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900">{customerProfile.description}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Subscriptions Section */}
        {customerDetails.subscriptions && customerDetails.subscriptions.length > 0 && (
          <SubscriptionList 
            subscriptions={customerDetails.subscriptions}
            onCancel={handleCancelSubscription}
            cancelingSubscriptionId={cancelingSubscriptionId}
          />
        )}

        {/* Payment Profiles Section */}
        <PaymentProfileList
          paymentProfiles={paymentProfiles}
          subscriptions={customerDetails.subscriptions}
          onDelete={handleDeletePaymentProfile}
          deletingProfileId={deletingProfileId}
          onCreateSubscription={handleCreateSubscription}
          creatingSubscriptionId={creatingSubscriptionId}
          onEdit={handleEditPaymentProfile}
          editingProfileId={editingProfileId}
          customerProfileId={customerProfile.profileId}
        />

        {/* Add Payment Profile Modal with Iframe */}
        {showAddPaymentModal && addPaymentFormUrl && addPaymentToken && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900">Add Payment Profile</h3>
                <button
                  onClick={handleCloseAddPaymentModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <div className="relative" style={{ minHeight: '600px' }}>
                  <form
                    id="addPaymentForm"
                    method="POST"
                    action={addPaymentFormUrl}
                    target="addPaymentIframe"
                    className="hidden"
                  >
                    <input type="hidden" name="token" value={addPaymentToken} />
                  </form>
                  <iframe
                    ref={addPaymentIframeRef}
                    id="addPaymentIframe"
                    name="addPaymentIframe"
                    className="w-full border-0"
                    style={{ minHeight: '600px', width: '100%' }}
                    title="Add Payment Profile"
                    allow="payment"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
