'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Customer {
  profileId: string;
  merchantCustomerId?: string;
  email?: string;
  description?: string;
  paymentProfiles?: any;
  shipToList?: any;
  error?: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/authorize/customers');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch customers');
      }

      setCustomers(data.customers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentProfileCount = (customer: Customer): number => {
    if (!customer.paymentProfiles) return 0;
    if (Array.isArray(customer.paymentProfiles)) {
      return customer.paymentProfiles.length;
    }
    if (customer.paymentProfiles.paymentProfile) {
      return Array.isArray(customer.paymentProfiles.paymentProfile)
        ? customer.paymentProfiles.paymentProfile.length
        : 1;
    }
    return 0;
  };

  const getPaymentMethodInfo = (customer: Customer): string => {
    if (!customer.paymentProfiles) return 'No payment methods';
    const profiles = Array.isArray(customer.paymentProfiles)
      ? customer.paymentProfiles
      : customer.paymentProfiles.paymentProfile
      ? Array.isArray(customer.paymentProfiles.paymentProfile)
        ? customer.paymentProfiles.paymentProfile
        : [customer.paymentProfiles.paymentProfile]
      : [];

    if (profiles.length === 0) return 'No payment methods';

    const methods = profiles.map((profile: any) => {
      if (profile.payment?.creditCard) {
        const card = profile.payment.creditCard;
        return `Card ending in ${card.cardNumber?.slice(-4) || '****'}`;
      }
      if (profile.payment?.bankAccount) {
        return 'Bank Account';
      }
      return 'Payment Method';
    });

    return methods.join(', ');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg">Loading customers...</div>
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
          <button
            onClick={fetchCustomers}
            className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Customer Profiles</h1>
          <button
            onClick={fetchCustomers}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {customers.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <p className="text-gray-500">No customers found.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Profile ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Email / Merchant ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Payment Methods
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Payment Profile Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {customers.map((customer) => (
                  <tr key={customer.profileId} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-900">
                      {customer.profileId}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>
                        {customer.email && (
                          <div className="font-medium">{customer.email}</div>
                        )}
                        {customer.merchantCustomerId && customer.merchantCustomerId !== customer.email && (
                          <div className="text-xs text-gray-500">
                            ID: {customer.merchantCustomerId}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {customer.error ? (
                        <span className="text-red-500">Error loading</span>
                      ) : (
                        getPaymentMethodInfo(customer)
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {customer.error ? (
                        <span className="text-red-500">-</span>
                      ) : (
                        getPaymentProfileCount(customer)
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <Link
                        href={`/customers/${customer.profileId}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          Total: {customers.length} customer{customers.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
