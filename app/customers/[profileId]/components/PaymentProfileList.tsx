'use client';

import { useState, useEffect, useRef } from 'react';

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
  profile?: {
    customerProfileId?: string;
    customerPaymentProfileId?: string;
    paymentProfile?: {
      customerPaymentProfileId?: string;
    };
  };
  error?: string;
}

interface PaymentProfileListProps {
  paymentProfiles: PaymentProfile[];
  subscriptions?: Subscription[];
  onDelete: (paymentProfileId: string) => void;
  deletingProfileId: string | null;
  onCreateSubscription?: (paymentProfileId: string, subscriptionData: any) => void;
  creatingSubscriptionId?: string | null;
  onEdit?: (paymentProfileId: string, profileData: PaymentProfile) => void;
  editingProfileId?: string | null;
  customerProfileId?: string;
}

export default function PaymentProfileList({
  paymentProfiles,
  subscriptions,
  onDelete,
  deletingProfileId,
  onCreateSubscription,
  creatingSubscriptionId,
  onEdit,
  editingProfileId,
  customerProfileId,
}: PaymentProfileListProps) {
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPaymentProfileId, setSelectedPaymentProfileId] = useState<string | null>(null);
  const [editFormUrl, setEditFormUrl] = useState<string | null>(null);
  const [editToken, setEditToken] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [formData, setFormData] = useState({
    subscriptionName: '',
    amount: '',
    intervalLength: '1',
    intervalUnit: 'months' as 'days' | 'months',
    startDate: '',
    totalOccurrences: '12',
    trialOccurrences: '0',
    trialAmount: '0.00',
  });

  const handleOpenModal = (paymentProfileId: string) => {
    setSelectedPaymentProfileId(paymentProfileId);
    // Set default start date to today
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setFormData({
      ...formData,
      startDate: `${year}-${month}-${day}`,
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedPaymentProfileId(null);
    setFormData({
      subscriptionName: '',
      amount: '',
      intervalLength: '1',
      intervalUnit: 'months',
      startDate: '',
      totalOccurrences: '12',
      trialOccurrences: '0',
      trialAmount: '0.00',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPaymentProfileId && onCreateSubscription) {
      onCreateSubscription(selectedPaymentProfileId, formData);
      handleCloseModal();
    }
  };

  // Auto-submit form to iframe when modal opens
  useEffect(() => {
    if (showEditModal && editToken && editFormUrl && selectedPaymentProfileId) {
      // Wait for iframe to be rendered, then submit form
      const timer = setTimeout(() => {
        const form = document.getElementById(`editForm_${selectedPaymentProfileId}`) as HTMLFormElement;
        if (form) {
          form.submit();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showEditModal, editToken, editFormUrl, selectedPaymentProfileId]);

  const handleOpenEditModal = async (profile: PaymentProfile) => {
    if (!customerProfileId) return;
    
    const paymentProfileId = profile.customerPaymentProfileId || profile.paymentProfileId || '';
    if (!paymentProfileId) return;

    try {
      setSelectedPaymentProfileId(paymentProfileId);
      // Get token for hosted form
      const response = await fetch(
        `/api/authorize/hosted-profile-edit/${customerProfileId}/${paymentProfileId}`,
        {
          method: 'POST',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get edit form token');
      }

      // Store token and form URL for iframe
      setEditToken(data.token);
      setEditFormUrl(data.formUrl);
      setShowEditModal(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to open edit form');
      console.error('Error opening edit form:', err);
      setSelectedPaymentProfileId(null);
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditFormUrl(null);
    setEditToken(null);
    setSelectedPaymentProfileId(null);
    // Refresh the page data after closing (in case edits were made)
    if (onEdit && customerProfileId) {
      // Trigger a refresh by calling the parent's refresh function
      window.location.reload();
    }
  };
  const formatCardNumber = (cardNumber?: string): string => {
    if (!cardNumber) return 'N/A';
    // If it's already masked (contains X), return as is
    if (cardNumber.includes('X')) return cardNumber;
    // Otherwise, show last 4 digits
    if (cardNumber.length >= 4) {
      return `****${cardNumber.slice(-4)}`;
    }
    return cardNumber;
  };

  const formatExpirationDate = (date?: string): string => {
    if (!date) return 'N/A';
    // If it's masked (contains X), return as is
    if (date.includes('X')) return date;
    // Format as MM/YY if it's YYYY-MM or similar
    if (date.length === 7 && date.includes('-')) {
      const [year, month] = date.split('-');
      return `${month}/${year.slice(-2)}`;
    }
    return date;
  };

  const getSubscriptionCountForPaymentProfile = (paymentProfileId: string): number => {
    if (!subscriptions) return 0;
    
    return subscriptions.filter((subscription) => {
      if (subscription.error) return false;
      
      // Check both possible locations for payment profile ID
      const subPaymentProfileId =
        subscription.profile?.paymentProfile?.customerPaymentProfileId ||
        subscription.profile?.customerPaymentProfileId;
      
      return subPaymentProfileId === paymentProfileId;
    }).length;
  };

  if (paymentProfiles.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Payment Profiles</h2>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
              0 Profiles
            </span>
          </div>
        </div>
        <div className="px-6 py-8 text-center">
          <p className="text-gray-500">No payment profiles found for this customer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Payment Profiles</h2>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            {paymentProfiles.length} {paymentProfiles.length === 1 ? 'Profile' : 'Profiles'}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Payment Profile ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Default
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                City, State, ZIP
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Country
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Payment Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Subscriptions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {paymentProfiles.map((profile, index) => {
              const paymentProfileId =
                profile.customerPaymentProfileId || profile.paymentProfileId || `Profile ${index + 1}`;
              const isDefault = profile.defaultPaymentProfile;
              const name = profile.billTo
                ? [profile.billTo.firstName, profile.billTo.lastName].filter(Boolean).join(' ') || '-'
                : '-';
              const address = profile.billTo?.address || '-';
              const cityStateZip = profile.billTo
                ? [profile.billTo.city, profile.billTo.state, profile.billTo.zip]
                    .filter(Boolean)
                    .join(', ') || '-'
                : '-';
              const country = profile.billTo?.country || '-';
              const phone = profile.billTo?.phoneNumber || '-';

              return (
                <tr key={paymentProfileId} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-900">
                    {paymentProfileId}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {isDefault ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                        Default
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{address}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{cityStateZip}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{country}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {profile.payment?.creditCard ? (
                      <div className="flex flex-col">
                        <div className="inline-flex items-center">
                          <span className="mr-2">💳</span>
                          <span className="font-medium">{profile.payment.creditCard.cardType || 'Credit Card'}</span>
                        </div>
                        <div className="mt-1 font-mono text-xs text-gray-600">
                          {formatCardNumber(profile.payment.creditCard.cardNumber)}
                        </div>
                        {profile.payment.creditCard.expirationDate && (
                          <div className="mt-1 text-xs text-gray-500">
                            Expires: {formatExpirationDate(profile.payment.creditCard.expirationDate)}
                          </div>
                        )}
                      </div>
                    ) : profile.payment?.bankAccount ? (
                      <div className="flex flex-col">
                        <div className="inline-flex items-center">
                          <span className="mr-2">🏦</span>
                          <span className="font-medium">{profile.payment.bankAccount.accountType || 'Bank Account'}</span>
                        </div>
                        <div className="mt-1 font-mono text-xs text-gray-600">
                          {formatCardNumber(profile.payment.bankAccount.accountNumber)}
                        </div>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-center">
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                      {getSubscriptionCountForPaymentProfile(paymentProfileId)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      {onEdit && customerProfileId && (
                        <button
                          onClick={() => handleOpenEditModal(profile)}
                          disabled={editingProfileId === paymentProfileId || selectedPaymentProfileId === paymentProfileId}
                          className="rounded bg-yellow-600 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Edit payment profile"
                        >
                          {selectedPaymentProfileId === paymentProfileId ? 'Loading...' : 'Edit'}
                        </button>
                      )}
                      {onCreateSubscription && (
                        <button
                          onClick={() => handleOpenModal(paymentProfileId)}
                          disabled={creatingSubscriptionId === paymentProfileId}
                          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Create subscription"
                        >
                          {creatingSubscriptionId === paymentProfileId ? 'Creating...' : 'Add Subscription'}
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(paymentProfileId)}
                        disabled={deletingProfileId === paymentProfileId}
                        className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Delete payment profile"
                      >
                        {deletingProfileId === paymentProfileId ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Subscription Creation Modal */}
      {showModal && onCreateSubscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Subscription</h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Subscription Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.subscriptionName}
                  onChange={(e) => setFormData({ ...formData, subscriptionName: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="e.g., Monthly Plan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Amount ($) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900">Interval Length</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.intervalLength}
                    onChange={(e) => setFormData({ ...formData, intervalLength: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900">Interval Unit</label>
                  <select
                    value={formData.intervalUnit}
                    onChange={(e) => setFormData({ ...formData, intervalUnit: e.target.value as 'days' | 'months' })}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="days">Days</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900">Start Date</label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900">Total Occurrences</label>
                <input
                  type="number"
                  min="1"
                  value={formData.totalOccurrences}
                  onChange={(e) => setFormData({ ...formData, totalOccurrences: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="12"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900">Trial Occurrences</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.trialOccurrences}
                    onChange={(e) => setFormData({ ...formData, trialOccurrences: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900">Trial Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.trialAmount}
                    onChange={(e) => setFormData({ ...formData, trialAmount: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Create Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Payment Profile Modal with Iframe */}
      {showEditModal && editFormUrl && editToken && selectedPaymentProfileId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Payment Profile</h3>
              <button
                onClick={handleCloseEditModal}
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
                  id={`editForm_${selectedPaymentProfileId}`}
                  method="POST"
                  action={editFormUrl}
                  target={`editIframe_${selectedPaymentProfileId}`}
                  className="hidden"
                >
                  <input type="hidden" name="token" value={editToken} />
                  <input type="hidden" name="paymentProfileId" value={selectedPaymentProfileId} />
                </form>
                <iframe
                  ref={iframeRef}
                  id={`editIframe_${selectedPaymentProfileId}`}
                  name={`editIframe_${selectedPaymentProfileId}`}
                  className="w-full border-0"
                  style={{ minHeight: '600px', width: '100%' }}
                  title="Edit Payment Profile"
                  allow="payment"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
