'use client';

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

interface SubscriptionListProps {
  subscriptions: Subscription[];
  onCancel?: (subscriptionId: string) => void;
  cancelingSubscriptionId?: string | null;
}

export default function SubscriptionList({ 
  subscriptions, 
  onCancel,
  cancelingSubscriptionId 
}: SubscriptionListProps) {
  if (!subscriptions || subscriptions.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 overflow-hidden rounded-lg bg-white shadow">
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Subscriptions</h2>
          <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
            {subscriptions.length}{' '}
            {subscriptions.length === 1 ? 'Subscription' : 'Subscriptions'}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Subscription ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Trial Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Interval
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Start Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Occurrences
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Payment Profile ID
              </th>
              {onCancel && (
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {subscriptions.map((subscription) => (
              <tr key={subscription.subscriptionId} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-900">
                  {subscription.error ? (
                    <span className="text-red-600">{subscription.subscriptionId}</span>
                  ) : (
                    subscription.subscriptionId
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {subscription.error ? (
                    <span className="text-red-600">Error loading</span>
                  ) : (
                    subscription.name || '-'
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {subscription.error ? (
                    <span className="text-red-600">Error</span>
                  ) : subscription.status ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        subscription.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : subscription.status === 'suspended'
                          ? 'bg-yellow-100 text-yellow-800'
                          : subscription.status === 'canceled'
                          ? 'bg-red-100 text-red-800'
                          : subscription.status === 'expired'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {subscription.status}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {subscription.error ? (
                    <span className="text-red-600">-</span>
                  ) : subscription.amount !== undefined && subscription.amount !== null ? (
                    `$${parseFloat(String(subscription.amount)).toFixed(2)}`
                  ) : (
                    '-'
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {subscription.error ? (
                    <span className="text-red-600">-</span>
                  ) : subscription.trialAmount !== undefined && 
                    subscription.trialAmount !== null && 
                    parseFloat(String(subscription.trialAmount)) > 0 ? (
                    `$${parseFloat(String(subscription.trialAmount)).toFixed(2)}`
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {subscription.error ? (
                    <span className="text-red-600">-</span>
                  ) : subscription.paymentSchedule?.interval ? (
                    `Every ${subscription.paymentSchedule.interval.length} ${
                      subscription.paymentSchedule.interval.unit || 'month'
                    }${String(subscription.paymentSchedule.interval.length) !== '1' ? 's' : ''}`
                  ) : (
                    '-'
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {subscription.error ? (
                    <span className="text-red-600">-</span>
                  ) : subscription.paymentSchedule?.startDate ? (
                    new Date(subscription.paymentSchedule.startDate).toLocaleDateString()
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {subscription.error ? (
                    <span className="text-red-600">-</span>
                  ) : subscription.paymentSchedule?.totalOccurrences !== undefined ? (
                    <div>
                      <div>Total: {subscription.paymentSchedule.totalOccurrences}</div>
                      {subscription.paymentSchedule.trialOccurrences !== undefined &&
                        parseFloat(String(subscription.paymentSchedule.trialOccurrences)) > 0 && (
                          <div className="text-xs text-gray-500">
                            Trial: {subscription.paymentSchedule.trialOccurrences}
                          </div>
                        )}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-500">
                  {subscription.error ? (
                    <span className="text-red-600">-</span>
                  ) : subscription.profile?.paymentProfile?.customerPaymentProfileId ? (
                    subscription.profile.paymentProfile.customerPaymentProfileId
                  ) : subscription.profile?.customerPaymentProfileId ? (
                    subscription.profile.customerPaymentProfileId
                  ) : (
                    '-'
                  )}
                </td>
                {onCancel && (
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {subscription.error ? (
                      <span className="text-gray-400">-</span>
                    ) : subscription.status === 'active' || subscription.status === 'suspended' ? (
                      <button
                        onClick={() => onCancel(subscription.subscriptionId)}
                        disabled={cancelingSubscriptionId === subscription.subscriptionId}
                        className="rounded bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Cancel subscription"
                      >
                        {cancelingSubscriptionId === subscription.subscriptionId ? 'Canceling...' : 'Cancel'}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {subscription.status === 'canceled' ? 'Canceled' : 'N/A'}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Error details for subscriptions with errors */}
      {subscriptions.some((sub) => sub.error) && (
        <div className="border-t border-gray-200 bg-red-50 px-6 py-4">
          <h3 className="mb-2 text-sm font-semibold text-red-900">Errors</h3>
          <div className="space-y-1">
            {subscriptions
              .filter((sub) => sub.error)
              .map((subscription) => (
                <div key={subscription.subscriptionId} className="text-sm text-red-600">
                  <span className="font-mono">{subscription.subscriptionId}:</span>{' '}
                  {subscription.error}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
