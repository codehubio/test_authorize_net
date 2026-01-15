import axios, { AxiosInstance } from 'axios';

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

interface MerchantAuthentication {
  name: string;
  transactionKey: string;
}

interface HostedPaymentSetting {
  settingName: string;
  settingValue: string;
}

interface GetHostedPaymentPageRequest {
  merchantAuthentication: MerchantAuthentication;
  refId?: string;
  transactionRequest?: {
    transactionType: string;
    amount?: string;
  };
  hostedPaymentSettings: {
    setting: HostedPaymentSetting[];
  };
}

interface GetHostedPaymentPageResponse {
  messages: {
    resultCode: string;
    message: Array<{
      code: string;
      text: string;
    }> | {
      code: string;
      text: string;
    };
  };
  token?: string;
  refId?: string;
}

export class AuthorizeNetService {
  private apiLoginId: string;
  private transactionKey: string;
  private apiEndpoint: string;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.apiLoginId = process.env.API_LOGIN_ID || '';
    this.transactionKey = process.env.TRANSACTION_KEY || '';
    
    // Use sandbox by default, or production if specified
    const isProduction = process.env.AUTHORIZE_NET_ENV === 'production';
    this.apiEndpoint = isProduction
      ? 'https://api.authorize.net/xml/v1/request.api'
      : 'https://apitest.authorize.net/xml/v1/request.api';

    if (!this.apiLoginId || !this.transactionKey) {
      throw new Error('API_LOGIN_ID and TRANSACTION_KEY environment variables are required');
    }

    this.axiosInstance = axios.create({
      timeout: 30000,
    });
  }
  

  /**
   * Get hosted payment page token for adding a card
   * @param amount Optional amount for the transaction
   * @param returnUrl Optional return URL (defaults to relative path)
   * @returns Token string to use with AcceptUI
   */
  async getHostedPaymentPageToken(amount?: string, returnUrl?: string): Promise<string> {
    // Ensure we have a valid base URL
    let baseUrl = returnUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Remove trailing slash if present
    baseUrl = baseUrl.replace(/\/$/, '');
    
    // Ensure URL starts with http:// or https://
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `http://${baseUrl}`;
    }
    
    // Build request object with correct element order for XML conversion
    // Order must be: merchantAuthentication, refId (optional), transactionRequest, hostedPaymentSettings
    // Note: transactionRequest appears to be required (or must be present) before hostedPaymentSettings
    const request: any = {
      merchantAuthentication: {
        name: this.apiLoginId,
        transactionKey: this.transactionKey,
      },
    };

    // transactionRequest must come BEFORE hostedPaymentSettings per API schema
    // Even for just collecting payment info (not processing), we need transactionRequest
    request.transactionRequest = amount
      ? {
          transactionType: 'authCaptureTransaction',
          amount: amount,
        }
      : {
          // For collecting payment info without processing, use authOnlyTransaction
          // Use minimal amount ($0.01) since $0.00 is rejected by the API
          // This transaction can be voided later if you only need the payment method
          transactionType: 'authOnlyTransaction',
          amount: '0.01',
        };

    // hostedPaymentSettings must come after transactionRequest
    const returnOptions = {
      showReceipt: false,
      url: `${baseUrl}/api/authorize/payment-response`,
      cancelUrl111111: `${baseUrl}/api/authorize/payment-cancel`,
    };
    
    console.log('Return options URLs:', returnOptions);
    
    request.hostedPaymentSettings = {
      setting: [
        {
          "settingName": "hostedPaymentBillingAddressOptions",
          "settingValue": "{\"show\": true, \"required\": false, \"fields\": {\"company\": \"hidden\"}}"
        },
        {
          settingName: 'hostedPaymentReturnOptions',
          settingValue: JSON.stringify(returnOptions),
        },
        {
          settingName: 'hostedPaymentButtonOptions',
          settingValue: JSON.stringify({
            text: 'Add Card',
          }),
        },
        {
          settingName: 'hostedPaymentPaymentOptions',
          settingValue: JSON.stringify({
            cardCodeRequired: true,
            showCreditCard: true,
            showBankAccount: false,
          }),
        },
        {
          settingName: 'hostedPaymentSecurityOptions',
          settingValue: JSON.stringify({
            captcha: false,
          }),
        },
      ],
    };

    try {
      const requestBody = {
        getHostedPaymentPageRequest: request,
      };
      
      // Log the request for debugging
      console.log('Authorize.net API Request:', JSON.stringify(requestBody, null, 2));
      
      const response = await this.axiosInstance.post(
        this.apiEndpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Log the response for debugging
      console.log('Authorize.net API Response:', JSON.stringify(response.data, null, 2));

      // Handle different possible response structures
      const responseData = response.data;
      let result: GetHostedPaymentPageResponse | undefined;

      // Check if response is nested under getHostedPaymentPageResponse
      if (responseData.getHostedPaymentPageResponse) {
        result = responseData.getHostedPaymentPageResponse;
      } 
      // Check if response is at root level
      else if (responseData.messages) {
        result = responseData as GetHostedPaymentPageResponse;
      }
      // Check if response is wrapped differently
      else {
        console.error('Unexpected response structure:', responseData);
        throw new Error('Unexpected response structure from Authorize.net API');
      }

      if (!result) {
        throw new Error('No valid response received from Authorize.net');
      }

      if (!result.messages) {
        throw new Error('Response missing messages field');
      }

      if (result.messages.resultCode !== 'Ok') {
        let errorMessages: string;
        if (Array.isArray(result.messages.message)) {
          errorMessages = result.messages.message.map((m) => m.text).join(', ');
        } else if (result.messages.message && typeof result.messages.message === 'object' && 'text' in result.messages.message) {
          errorMessages = result.messages.message.text;
        } else {
          errorMessages = 'Unknown error';
        }
        throw new Error(`Authorize.net API error: ${errorMessages}`);
      }

      if (!result.token) {
        throw new Error('No token received from Authorize.net');
      }

      return result.token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Log the full error for debugging
        console.error('Authorize.net API Error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        // Try to extract error message from response
        if (error.response?.data) {
          const responseData = error.response.data;
          
          // Check nested structure
          if (responseData.getHostedPaymentPageResponse?.messages) {
            const messages = responseData.getHostedPaymentPageResponse.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          // Check root level messages
          if (responseData.messages) {
            const messages = responseData.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          // If we have data but can't parse it, show it
          throw new Error(
            `Authorize.net API error: ${JSON.stringify(responseData)}`
          );
        }
        
        throw new Error(
          `Failed to get hosted payment page token: ${getErrorMessage(error)}`
        );
      }
      throw error;
    }
  }

  /**
   * Get customer profile by merchant customer ID (email)
   * Since we use email as merchantCustomerId when creating profiles, we can look it up
   * @param email Customer email address (used as merchantCustomerId)
   * @returns Customer profile ID if found, null otherwise
   */
  async getCustomerProfileByEmail(email: string): Promise<string | null> {
    const request = {
      merchantAuthentication: {
        name: this.apiLoginId,
        transactionKey: this.transactionKey,
      },
      merchantCustomerId: email, // We use email as merchantCustomerId
    };

    try {
      const response = await this.axiosInstance.post(
        this.apiEndpoint,
        {
          getCustomerProfileRequest: request,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const responseData = response.data;
      let result: any;

      if (responseData.getCustomerProfileResponse) {
        result = responseData.getCustomerProfileResponse;
      } else if (responseData.messages) {
        result = responseData;
      } else {
        throw new Error('Unexpected response structure from Authorize.net API');
      }

      if (!result.messages) {
        throw new Error('Response missing messages field');
      }

      // Log response for debugging
      console.log('Get Customer Profile Response:', JSON.stringify(result, null, 2));

      // If profile not found, return null (this is not an error)
      if (result.messages.resultCode !== 'Ok') {
        const errorCode = Array.isArray(result.messages.message) 
          ? result.messages.message[0]?.code 
          : result.messages.message?.code;
        
        // E00040 = Customer profile not found - this is expected for new customers
        if (errorCode === 'E00040') {
          return null;
        }
        
        // Other errors should be thrown
        let errorMessages: string;
        if (Array.isArray(result.messages.message)) {
          errorMessages = result.messages.message.map((m: { text: string }) => m.text).join(', ');
        } else if (result.messages.message && typeof result.messages.message === 'object' && 'text' in result.messages.message) {
          errorMessages = result.messages.message.text;
        } else {
          errorMessages = 'Unknown error';
        }
        throw new Error(`Authorize.net API error: ${errorMessages}`);
      }

      // Extract customer profile ID
      if (result.profile && result.profile.customerProfileId) {
        return String(result.profile.customerProfileId);
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Authorize.net API Error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data) {
          const responseData = error.response.data;
          
          // Check if it's a "not found" error
          const errorCode = responseData.getCustomerProfileResponse?.messages?.message?.[0]?.code ||
                           responseData.messages?.message?.[0]?.code ||
                           (Array.isArray(responseData.getCustomerProfileResponse?.messages?.message) 
                             ? responseData.getCustomerProfileResponse.messages.message[0]?.code 
                             : null);
          
          if (errorCode === 'E00040') {
            return null; // Profile not found - this is OK
          }
          
          if (responseData.getCustomerProfileResponse?.messages) {
            const messages = responseData.getCustomerProfileResponse.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          if (responseData.messages) {
            const messages = responseData.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
        }
        
        throw new Error(`Failed to get customer profile: ${getErrorMessage(error)}`);
      }
      throw error;
    }
  }

  /**
   * Create a customer profile
   * @param email Customer email address
   * @returns Customer profile ID
   */
  async createCustomerProfile(email: string): Promise<string> {
    const request = {
      merchantAuthentication: {
        name: this.apiLoginId,
        transactionKey: this.transactionKey,
      },
      profile: {
        merchantCustomerId: email, // Use email as merchant customer ID
        email: email,
      },
    };

    try {
      const response = await this.axiosInstance.post(
        this.apiEndpoint,
        {
          createCustomerProfileRequest: request,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const responseData = response.data;
      let result: any;

      if (responseData.createCustomerProfileResponse) {
        result = responseData.createCustomerProfileResponse;
      } else if (responseData.messages) {
        result = responseData;
      } else {
        throw new Error('Unexpected response structure from Authorize.net API');
      }

      if (!result.messages) {
        throw new Error('Response missing messages field');
      }

      if (result.messages.resultCode !== 'Ok') {
        let errorMessages: string;
        if (Array.isArray(result.messages.message)) {
          errorMessages = result.messages.message.map((m: { text: string }) => m.text).join(', ');
        } else if (result.messages.message && typeof result.messages.message === 'object' && 'text' in result.messages.message) {
          errorMessages = result.messages.message.text;
        } else {
          errorMessages = 'Unknown error';
        }
        throw new Error(`Authorize.net API error: ${errorMessages}`);
      }

      if (!result.customerProfileId) {
        throw new Error('No customer profile ID received from Authorize.net');
      }

      return result.customerProfileId;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Authorize.net API Error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data) {
          const responseData = error.response.data;
          
          if (responseData.createCustomerProfileResponse?.messages) {
            const messages = responseData.createCustomerProfileResponse.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          if (responseData.messages) {
            const messages = responseData.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
        }
        
        throw new Error(`Failed to create customer profile: ${getErrorMessage(error)}`);
      }
      throw error;
    }
  }

  /**
   * Get or create customer profile by email
   * @param email Customer email address
   * @returns Customer profile ID
   */
  async getOrCreateCustomerProfile(email: string): Promise<string> {
    // First, check if profile exists
    const profileId = await this.getCustomerProfileByEmail(email);
    
    if (profileId) {
      console.log(`Customer profile found for email ${email}: ${profileId}`);
      return profileId;
    }

    // Profile doesn't exist, create it
    console.log(`Creating new customer profile for email ${email}`);
    return await this.createCustomerProfile(email);
  }

  /**
   * Get customer profile IDs list
   * Returns all customer profile IDs associated with the merchant account
   * @returns Array of customer profile IDs
   */
  async getCustomerProfileIds(): Promise<string[]> {
    const request = {
      merchantAuthentication: {
        name: this.apiLoginId,
        transactionKey: this.transactionKey,
      },
    };

    try {
      const response = await this.axiosInstance.post(
        this.apiEndpoint,
        {
          getCustomerProfileIdsRequest: request,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const responseData = response.data;
      let result: any;

      if (responseData.getCustomerProfileIdsResponse) {
        result = responseData.getCustomerProfileIdsResponse;
      } else if (responseData.messages) {
        result = responseData;
      } else {
        throw new Error('Unexpected response structure from Authorize.net API');
      }

      if (!result.messages) {
        throw new Error('Response missing messages field');
      }

      // Log response for debugging
      console.log('Get Customer Profile IDs Response:', JSON.stringify(result, null, 2));

      if (result.messages.resultCode !== 'Ok') {
        let errorMessages: string;
        if (Array.isArray(result.messages.message)) {
          errorMessages = result.messages.message.map((m: { text: string }) => m.text).join(', ');
        } else if (result.messages.message && typeof result.messages.message === 'object' && 'text' in result.messages.message) {
          errorMessages = result.messages.message.text;
        } else {
          errorMessages = 'Unknown error';
        }
        throw new Error(`Authorize.net API error: ${errorMessages}`);
      }

      // Extract customer profile IDs
      if (result.ids && result.ids.numericString) {
        // Handle array of IDs
        if (Array.isArray(result.ids.numericString)) {
          return result.ids.numericString.map((id: string | number) => String(id));
        } else {
          // Single ID
          return [String(result.ids.numericString)];
        }
      }

      // Alternative structure: ids as array
      if (Array.isArray(result.ids)) {
        return result.ids.map((id: string | number) => String(id));
      }

      return [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Authorize.net API Error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data) {
          const responseData = error.response.data;
          
          if (responseData.getCustomerProfileIdsResponse?.messages) {
            const messages = responseData.getCustomerProfileIdsResponse.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          if (responseData.messages) {
            const messages = responseData.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
        }
        
        throw new Error(`Failed to get customer profile IDs: ${getErrorMessage(error)}`);
      }
      throw error;
    }
  }

  /**
   * Get full customer profile by profile ID
   * @param customerProfileId Customer profile ID
   * @returns Full customer profile data
   */
  async getCustomerProfile(customerProfileId: string): Promise<any> {
    const request = {
      merchantAuthentication: {
        name: this.apiLoginId,
        transactionKey: this.transactionKey,
      },
      customerProfileId: customerProfileId,
    };

    try {
      const response = await this.axiosInstance.post(
        this.apiEndpoint,
        {
          getCustomerProfileRequest: request,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const responseData = response.data;
      let result: any;

      if (responseData.getCustomerProfileResponse) {
        result = responseData.getCustomerProfileResponse;
      } else if (responseData.messages) {
        result = responseData;
      } else {
        throw new Error('Unexpected response structure from Authorize.net API');
      }

      if (!result.messages) {
        throw new Error('Response missing messages field');
      }

      if (result.messages.resultCode !== 'Ok') {
        let errorMessages: string;
        if (Array.isArray(result.messages.message)) {
          errorMessages = result.messages.message.map((m: { text: string }) => m.text).join(', ');
        } else if (result.messages.message && typeof result.messages.message === 'object' && 'text' in result.messages.message) {
          errorMessages = result.messages.message.text;
        } else {
          errorMessages = 'Unknown error';
        }
        throw new Error(`Authorize.net API error: ${errorMessages}`);
      }

      // Return the full response including subscriptionIds at root level
      // The response structure has: { profile: {...}, subscriptionIds: [...], messages: {...} }
      return result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Authorize.net API Error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data) {
          const responseData = error.response.data;
          
          if (responseData.getCustomerProfileResponse?.messages) {
            const messages = responseData.getCustomerProfileResponse.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          if (responseData.messages) {
            const messages = responseData.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
        }
        
        throw new Error(`Failed to get customer profile: ${getErrorMessage(error)}`);
      }
      throw error;
    }
  }

  /**
   * Get hosted profile page token for adding a payment method to a customer profile
   * @param customerProfileId Customer profile ID
   * @param returnUrl Optional return URL (defaults to relative path)
   * @returns Token string to use with AcceptUI
   */
  async getHostedProfilePageToken(customerProfileId: string, returnUrl?: string): Promise<string> {
    // Ensure we have a valid base URL
    let baseUrl = returnUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Remove trailing slash if present
    baseUrl = baseUrl.replace(/\/$/, '');
    
    // Ensure URL starts with http:// or https://
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `http://${baseUrl}`;
    }

    const request: any = {
      merchantAuthentication: {
        name: this.apiLoginId,
        transactionKey: this.transactionKey,
      },
      customerProfileId: customerProfileId,
      hostedProfileSettings: {
        setting: [
          {
            settingName: 'hostedProfilePageBorderVisible',
            settingValue: false,
          },
          {
            settingName: 'hostedProfileReturnUrl',
            settingValue: `${baseUrl}/profile-return.html`,
          },
          {
            settingName: 'hostedProfileIFrameCommunicatorUrl',
            settingValue: `${baseUrl}/communicator.html`,
          },
          {
            settingName: 'hostedProfileBillingAddressOptions',
            settingValue: "showBillingAddress",
          },
          {
            settingName: 'hostedProfileValidationMode',
            settingValue: "testMode",
          },
        ],
      },
    };

    try {
      const requestBody = {
        getHostedProfilePageRequest: request,
      };
      
      // Log the request for debugging
      console.log('Authorize.net Hosted Profile API Request:', JSON.stringify(requestBody, null, 2));
      
      const response = await this.axiosInstance.post(
        this.apiEndpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Log the response for debugging
      console.log('Authorize.net Hosted Profile API Response:', JSON.stringify(response.data, null, 2));

      // Handle different possible response structures
      const responseData = response.data;
      let result: any;

      if (responseData.getHostedProfilePageResponse) {
        result = responseData.getHostedProfilePageResponse;
      } else if (responseData.messages) {
        result = responseData;
      } else {
        console.error('Unexpected response structure:', responseData);
        throw new Error('Unexpected response structure from Authorize.net API');
      }

      if (!result) {
        throw new Error('No valid response received from Authorize.net');
      }

      if (!result.messages) {
        throw new Error('Response missing messages field');
      }

      if (result.messages.resultCode !== 'Ok') {
        let errorMessages: string;
        if (Array.isArray(result.messages.message)) {
          errorMessages = result.messages.message.map((m: { text: string }) => m.text).join(', ');
        } else if (result.messages.message && typeof result.messages.message === 'object' && 'text' in result.messages.message) {
          errorMessages = result.messages.message.text;
        } else {
          errorMessages = 'Unknown error';
        }
        throw new Error(`Authorize.net API error: ${errorMessages}`);
      }

      if (!result.token) {
        throw new Error('No token received from Authorize.net');
      }

      return result.token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Authorize.net API Error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data) {
          const responseData = error.response.data;
          
          if (responseData.getHostedProfilePageResponse?.messages) {
            const messages = responseData.getHostedProfilePageResponse.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          if (responseData.messages) {
            const messages = responseData.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          throw new Error(
            `Authorize.net API error: ${JSON.stringify(responseData)}`
          );
        }
        
        throw new Error(
          `Failed to get hosted profile page token: ${getErrorMessage(error)}`
        );
      }
      throw error;
    }
  }

  /**
   * Get customer payment profile list
   * Uses getCustomerProfileRequest to get the full customer profile which includes payment profiles
   * @param customerProfileId Customer profile ID
   * @returns Array of payment profiles
   */
  async getCustomerPaymentProfileList(customerProfileId: string): Promise<any[]> {
    const request = {
      merchantAuthentication: {
        name: this.apiLoginId,
        transactionKey: this.transactionKey,
      },
      customerProfileId: customerProfileId,
    };

    try {
      const requestBody = {
        getCustomerProfileRequest: request,
      };
      
      // Log the request for debugging
      console.log('Authorize.net Get Customer Profile API Request:', JSON.stringify(requestBody, null, 2));
      
      const response = await this.axiosInstance.post(
        this.apiEndpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      // Log the response for debugging
      console.log('Authorize.net Get Customer Profile API Response:', JSON.stringify(response.data, null, 2));

      const responseData = response.data;
      let result: any;

      if (responseData.getCustomerProfileResponse) {
        result = responseData.getCustomerProfileResponse;
      } else if (responseData.messages) {
        result = responseData;
      } else {
        throw new Error('Unexpected response structure from Authorize.net API');
      }

      if (!result.messages) {
        throw new Error('Response missing messages field');
      }

      if (result.messages.resultCode !== 'Ok') {
        let errorMessages: string;
        if (Array.isArray(result.messages.message)) {
          errorMessages = result.messages.message.map((m: { text: string }) => m.text).join(', ');
        } else if (result.messages.message && typeof result.messages.message === 'object' && 'text' in result.messages.message) {
          errorMessages = result.messages.message.text;
        } else {
          errorMessages = 'Unknown error';
        }
        throw new Error(`Authorize.net API error: ${errorMessages}`);
      }

      // Extract payment profiles from the customer profile
      // The profile object contains paymentProfiles array
      if (result.profile && result.profile.paymentProfiles) {
        const paymentProfiles = result.profile.paymentProfiles;
        // Handle both array and single object cases
        if (Array.isArray(paymentProfiles)) {
          return paymentProfiles;
        } else if (paymentProfiles.paymentProfile) {
          // Sometimes it's wrapped in a paymentProfile object
          if (Array.isArray(paymentProfiles.paymentProfile)) {
            return paymentProfiles.paymentProfile;
          } else {
            return [paymentProfiles.paymentProfile];
          }
        }
      }
      
      // Alternative structure: paymentProfiles at root level
      if (result.paymentProfiles && Array.isArray(result.paymentProfiles)) {
        return result.paymentProfiles;
      }
      
      if (result.paymentProfileList && Array.isArray(result.paymentProfileList)) {
        return result.paymentProfileList;
      }
      
      // Sometimes it's a single paymentProfile object
      if (result.paymentProfile) {
        return [result.paymentProfile];
      }

      return [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Authorize.net API Error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data) {
          const responseData = error.response.data;
          
          if (responseData.getCustomerProfileResponse?.messages) {
            const messages = responseData.getCustomerProfileResponse.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          if (responseData.messages) {
            const messages = responseData.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
        }
        
        throw new Error(`Failed to get customer payment profile list: ${getErrorMessage(error)}`);
      }
      throw error;
    }
  }

  /**
   * Get a single customer payment profile
   * @param customerProfileId Customer profile ID
   * @param paymentProfileId Payment profile ID
   * @returns Payment profile data
   */
  async getCustomerPaymentProfile(
    customerProfileId: string,
    paymentProfileId: string
  ): Promise<any> {
    const request = {
      merchantAuthentication: {
        name: this.apiLoginId,
        transactionKey: this.transactionKey,
      },
      customerProfileId: customerProfileId,
      customerPaymentProfileId: paymentProfileId,
    };

    try {
      const requestBody = {
        getCustomerPaymentProfileRequest: request,
      };
      
      // Log the request for debugging
      console.log('Authorize.net Get Customer Payment Profile API Request:', JSON.stringify(requestBody, null, 2));
      
      const response = await this.axiosInstance.post(
        this.apiEndpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      // Log the response for debugging
      console.log('Authorize.net Get Customer Payment Profile API Response:', JSON.stringify(response.data, null, 2));

      const responseData = response.data;
      let result: any;

      if (responseData.getCustomerPaymentProfileResponse) {
        result = responseData.getCustomerPaymentProfileResponse;
      } else if (responseData.messages) {
        result = responseData;
      } else {
        throw new Error('Unexpected response structure from Authorize.net API');
      }

      if (!result.messages) {
        throw new Error('Response missing messages field');
      }

      if (result.messages.resultCode !== 'Ok') {
        let errorMessages: string;
        if (Array.isArray(result.messages.message)) {
          errorMessages = result.messages.message.map((m: { text: string }) => m.text).join(', ');
        } else if (result.messages.message && typeof result.messages.message === 'object' && 'text' in result.messages.message) {
          errorMessages = result.messages.message.text;
        } else {
          errorMessages = 'Unknown error';
        }
        throw new Error(`Authorize.net API error: ${errorMessages}`);
      }

      // Return the payment profile
      return result.paymentProfile || result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Authorize.net API Error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data) {
          const responseData = error.response.data;
          
          if (responseData.getCustomerPaymentProfileResponse?.messages) {
            const messages = responseData.getCustomerPaymentProfileResponse.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          if (responseData.messages) {
            const messages = responseData.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
        }
        
        throw new Error(`Failed to get customer payment profile: ${getErrorMessage(error)}`);
      }
      throw error;
    }
  }

  /**
   * Sanitize credit card data for update requests
   * Removes fields that aren't allowed in update requests (like cardType)
   * Based on API example, only cardNumber and expirationDate are needed
   * @param creditCard Credit card object from API response
   * @returns Sanitized credit card object
   */
  private sanitizeCreditCardForUpdate(creditCard: any): any {
    const sanitized: any = {};
    
    // Include only cardNumber and expirationDate as per API example
    // These should be masked values (e.g., "XXXX1111" and "XXXX")
    if (creditCard.cardNumber) sanitized.cardNumber = creditCard.cardNumber;
    if (creditCard.expirationDate) sanitized.expirationDate = creditCard.expirationDate;
    
    // Note: Other fields like cardCode, cardType, etc. are not included
    // as they cause validation errors in update requests
    
    return sanitized;
  }

  /**
   * Sanitize payment data for update requests
   * Filters out invalid fields from payment objects
   * @param payment Payment object from API response
   * @returns Sanitized payment object
   */
  private sanitizePaymentForUpdate(payment: any): any {
    const sanitized: any = {};
    
    if (payment.creditCard) {
      sanitized.creditCard = this.sanitizeCreditCardForUpdate(payment.creditCard);
    }
    
    if (payment.bankAccount) {
      // For bank accounts, include all fields (they're typically all allowed)
      sanitized.bankAccount = payment.bankAccount;
    }
    
    return sanitized;
  }

  /**
   * Update customer payment profile
   * First fetches the full payment profile, then updates with all fields preserved
   * @param customerProfileId Customer profile ID
   * @param paymentProfileId Payment profile ID
   * @param firstName First name
   * @param lastName Last name
   * @returns Updated payment profile ID
   */
  async updateCustomerPaymentProfile(
    customerProfileId: string,
    paymentProfileId: string,
    firstName: string,
    lastName: string
  ): Promise<string> {
    // First, get the full payment profile to preserve all existing data
    const existingProfile = await this.getCustomerPaymentProfile(customerProfileId, paymentProfileId);
    console.log(`Start showing existing profile`);
    console.log(JSON.stringify(existingProfile, null, 2));
    console.log(`End showing existing profile`);
    // Extract the payment profile data (handle different response structures)
    const profileData = existingProfile.paymentProfile || existingProfile;
    
    // Build the payment profile with all existing fields, updating only firstName and lastName
    // Field order per API example: billTo, payment, defaultPaymentProfile, customerPaymentProfileId
    const paymentProfile: any = {};

    // Build billTo with all existing fields, updating firstName and lastName
    // billTo comes first in the structure
    const billTo: any = {
      firstName: firstName,
      lastName: lastName,
    };

    // Preserve all other billTo fields if they exist (include empty strings to preserve them)
    const existingBillTo = profileData.billTo || {};
    billTo.company = existingBillTo.company !== undefined ? existingBillTo.company : '';
    billTo.address = existingBillTo.address !== undefined ? existingBillTo.address : '';
    billTo.city = existingBillTo.city !== undefined ? existingBillTo.city : '';
    billTo.state = existingBillTo.state !== undefined ? existingBillTo.state : '';
    billTo.zip = existingBillTo.zip !== undefined ? existingBillTo.zip : '';
    billTo.country = existingBillTo.country !== undefined ? existingBillTo.country : '';
    billTo.phoneNumber = existingBillTo.phoneNumber !== undefined ? existingBillTo.phoneNumber : '';
    billTo.faxNumber = existingBillTo.faxNumber !== undefined ? existingBillTo.faxNumber : '';

    paymentProfile.billTo = billTo;

    // Include payment information (required to preserve payment method)
    if (profileData.payment) {
      paymentProfile.payment = this.sanitizePaymentForUpdate(profileData.payment);
    } else if (profileData.creditCard) {
      // Handle case where creditCard is at root level
      paymentProfile.payment = {
        creditCard: this.sanitizeCreditCardForUpdate(profileData.creditCard),
      };
    } else if (profileData.bankAccount) {
      // Handle bank account payments
      paymentProfile.payment = {
        bankAccount: profileData.bankAccount,
      };
    } else {
      // Payment information is required - if missing, we can't update
      throw new Error('Payment information not found in payment profile. Cannot update without payment method.');
    }

    // Include defaultPaymentProfile if it exists
    if (profileData.defaultPaymentProfile !== undefined) {
      paymentProfile.defaultPaymentProfile = profileData.defaultPaymentProfile;
    }

    // Add customerPaymentProfileId last
    paymentProfile.customerPaymentProfileId = paymentProfileId;

    const request: any = {
      merchantAuthentication: {
        name: this.apiLoginId,
        transactionKey: this.transactionKey,
      },
      customerProfileId: customerProfileId,
      paymentProfile: paymentProfile,
      validationMode: 'testMode', // Use liveMode for validation as per API example
    };

    try {
      const requestBody = {
        updateCustomerPaymentProfileRequest: request,
      };
      
      // Log the request for debugging
      console.log('Authorize.net Update Payment Profile API Request:', JSON.stringify(requestBody, null, 2));
      
      const response = await this.axiosInstance.post(
        this.apiEndpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      // Log the response for debugging
      console.log('Authorize.net Update Payment Profile API Response:', JSON.stringify(response.data, null, 2));

      const responseData = response.data;
      let result: any;

      if (responseData.updateCustomerPaymentProfileResponse) {
        result = responseData.updateCustomerPaymentProfileResponse;
      } else if (responseData.messages) {
        result = responseData;
      } else {
        throw new Error('Unexpected response structure from Authorize.net API');
      }

      if (!result.messages) {
        throw new Error('Response missing messages field');
      }

      if (result.messages.resultCode !== 'Ok') {
        let errorMessages: string;
        if (Array.isArray(result.messages.message)) {
          errorMessages = result.messages.message.map((m: { text: string }) => m.text).join(', ');
        } else if (result.messages.message && typeof result.messages.message === 'object' && 'text' in result.messages.message) {
          errorMessages = result.messages.message.text;
        } else {
          errorMessages = 'Unknown error';
        }
        throw new Error(`Authorize.net API error: ${errorMessages}`);
      }
      
      return paymentProfileId;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Authorize.net API Error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data) {
          const responseData = error.response.data;
          
          if (responseData.updateCustomerPaymentProfileResponse?.messages) {
            const messages = responseData.updateCustomerPaymentProfileResponse.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          if (responseData.messages) {
            const messages = responseData.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
        }
        
        throw new Error(`Failed to update customer payment profile: ${getErrorMessage(error)}`);
      }
      throw error;
    }
  }

  /**
   * Create an ARB subscription using customer profile and payment profile
   * @param customerProfileId Customer profile ID
   * @param paymentProfileId Payment profile ID
   * @param subscriptionName Name of the subscription
   * @param amount Subscription amount
   * @param intervalLength Billing interval length (default: 1)
   * @param intervalUnit Billing interval unit: "days", "months" (default: "months")
   * @param startDate Subscription start date in YYYY-MM-DD format (default: today)
   * @param totalOccurrences Total number of billing occurrences (default: 12)
   * @param trialOccurrences Number of trial occurrences (default: 0)
   * @param trialAmount Trial amount (default: "0.00")
   * @param refId Optional reference ID
   * @returns Subscription ID
   */
  async createSubscription(
    customerProfileId: string,
    paymentProfileId: string,
    subscriptionName: string,
    amount: string,
    intervalLength: string = "1",
    intervalUnit: "days" | "months" = "months",
    startDate?: string,
    totalOccurrences: string = "12",
    trialOccurrences: string = "0",
    trialAmount: string = "0.00",
    refId?: string
  ): Promise<string> {
    // Default start date to today if not provided
    if (!startDate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      startDate = `${year}-${month}-${day}`;
    }

    const request: any = {
      merchantAuthentication: {
        name: this.apiLoginId,
        transactionKey: this.transactionKey,
      },
      subscription: {
        name: subscriptionName,
        paymentSchedule: {
          interval: {
            length: intervalLength,
            unit: intervalUnit,
          },
          startDate: startDate,
          totalOccurrences: totalOccurrences,
          trialOccurrences: trialOccurrences,
        },
        amount: amount,
        trialAmount: trialAmount,
        "profile": {
                "customerProfileId": customerProfileId,
                "customerPaymentProfileId": paymentProfileId
            }
        
      },
    };

    // Add refId if provided
    if (refId) {
      request.refId = refId;
    }

    try {
      const requestBody = {
        ARBCreateSubscriptionRequest: request,
      };
      
      // Log the request for debugging
      console.log('Authorize.net ARB Create Subscription API Request:', JSON.stringify(requestBody, null, 2));
      
      const response = await this.axiosInstance.post(
        this.apiEndpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      // Log the response for debugging
      console.log('Authorize.net ARB Create Subscription API Response:', JSON.stringify(response.data, null, 2));

      const responseData = response.data;
      let result: any;

      if (responseData.ARBCreateSubscriptionResponse) {
        result = responseData.ARBCreateSubscriptionResponse;
      } else if (responseData.messages) {
        result = responseData;
      } else {
        throw new Error('Unexpected response structure from Authorize.net API');
      }

      if (!result.messages) {
        throw new Error('Response missing messages field');
      }

      if (result.messages.resultCode !== 'Ok') {
        let errorMessages: string;
        if (Array.isArray(result.messages.message)) {
          errorMessages = result.messages.message.map((m: { text: string }) => m.text).join(', ');
        } else if (result.messages.message && typeof result.messages.message === 'object' && 'text' in result.messages.message) {
          errorMessages = result.messages.message.text;
        } else {
          errorMessages = 'Unknown error';
        }
        throw new Error(`Authorize.net API error: ${errorMessages}`);
      }

      if (!result.subscriptionId) {
        throw new Error('No subscription ID received from Authorize.net');
      }

      console.log('Subscription created successfully. Subscription ID:', result.subscriptionId);
      return result.subscriptionId;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Authorize.net API Error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data) {
          const responseData = error.response.data;
          
          if (responseData.ARBCreateSubscriptionResponse?.messages) {
            const messages = responseData.ARBCreateSubscriptionResponse.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          if (responseData.messages) {
            const messages = responseData.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
        }
        
        throw new Error(`Failed to create subscription: ${getErrorMessage(error)}`);
      }
      throw error;
    }
  }

  /**
   * Get subscription details by subscription ID
   * @param subscriptionId Subscription ID
   * @returns Subscription details
   */
  async getSubscription(subscriptionId: string): Promise<any> {
    const request = {
      merchantAuthentication: {
        name: this.apiLoginId,
        transactionKey: this.transactionKey,
      },
      subscriptionId: subscriptionId,
    };

    try {
      const requestBody = {
        ARBGetSubscriptionRequest: request,
      };
      
      // Log the request for debugging
      console.log('Authorize.net Get Subscription API Request:', JSON.stringify(requestBody, null, 2));
      
      const response = await this.axiosInstance.post(
        this.apiEndpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      // Log the response for debugging
      console.log('Authorize.net Get Subscription API Response:', JSON.stringify(response.data, null, 2));

      const responseData = response.data;
      let result: any;

      if (responseData.ARBGetSubscriptionResponse) {
        result = responseData.ARBGetSubscriptionResponse;
      } else if (responseData.subscription) {
        result = responseData;
      } else if (responseData.messages) {
        result = responseData;
      } else {
        throw new Error('Unexpected response structure from Authorize.net API');
      }

      if (!result.messages) {
        throw new Error('Response missing messages field');
      }

      if (result.messages.resultCode !== 'Ok') {
        let errorMessages: string;
        if (Array.isArray(result.messages.message)) {
          errorMessages = result.messages.message.map((m: { text: string }) => m.text).join(', ');
        } else if (result.messages.message && typeof result.messages.message === 'object' && 'text' in result.messages.message) {
          errorMessages = result.messages.message.text;
        } else {
          errorMessages = 'Unknown error';
        }
        throw new Error(`Authorize.net API error: ${errorMessages}`);
      }

      // Return the subscription data
      // The response structure has subscription nested under subscription key
      const subscriptionData = result.subscription || result;
      
      // Ensure amount and trialAmount are strings for consistency
      if (subscriptionData.amount !== undefined && typeof subscriptionData.amount === 'number') {
        subscriptionData.amount = String(subscriptionData.amount);
      }
      if (subscriptionData.trialAmount !== undefined && typeof subscriptionData.trialAmount === 'number') {
        subscriptionData.trialAmount = String(subscriptionData.trialAmount);
      }
      
      // Extract payment profile ID from nested structure
      if (subscriptionData.profile?.paymentProfile?.customerPaymentProfileId) {
        if (!subscriptionData.profile.customerPaymentProfileId) {
          subscriptionData.profile.customerPaymentProfileId = subscriptionData.profile.customerProfileId;
        }
        subscriptionData.profile.customerPaymentProfileId = subscriptionData.profile.paymentProfile.customerPaymentProfileId;
      }
      
      return subscriptionData;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Authorize.net API Error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data) {
          const responseData = error.response.data;
          
          if (responseData.ARBGetSubscriptionResponse?.messages) {
            const messages = responseData.ARBGetSubscriptionResponse.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          if (responseData.messages) {
            const messages = responseData.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
        }
        
        throw new Error(`Failed to get subscription: ${getErrorMessage(error)}`);
      }
      throw error;
    }
  }

  /**
   * Delete customer payment profile
   * @param customerProfileId Customer profile ID
   * @param paymentProfileId Payment profile ID
   * @returns Success status
   */
  async deleteCustomerPaymentProfile(
    customerProfileId: string,
    paymentProfileId: string
  ): Promise<boolean> {
    const request = {
      merchantAuthentication: {
        name: this.apiLoginId,
        transactionKey: this.transactionKey,
      },
      customerProfileId: customerProfileId,
      customerPaymentProfileId: paymentProfileId,
    };

    try {
      const requestBody = {
        deleteCustomerPaymentProfileRequest: request,
      };
      
      // Log the request for debugging
      console.log('Authorize.net Delete Customer Payment Profile API Request:', JSON.stringify(requestBody, null, 2));
      
      const response = await this.axiosInstance.post(
        this.apiEndpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      // Log the response for debugging
      console.log('Authorize.net Delete Customer Payment Profile API Response:', JSON.stringify(response.data, null, 2));

      const responseData = response.data;
      let result: any;

      if (responseData.deleteCustomerPaymentProfileResponse) {
        result = responseData.deleteCustomerPaymentProfileResponse;
      } else if (responseData.messages) {
        result = responseData;
      } else {
        throw new Error('Unexpected response structure from Authorize.net API');
      }

      if (!result.messages) {
        throw new Error('Response missing messages field');
      }

      if (result.messages.resultCode !== 'Ok') {
        let errorMessages: string;
        if (Array.isArray(result.messages.message)) {
          errorMessages = result.messages.message.map((m: { text: string }) => m.text).join(', ');
        } else if (result.messages.message && typeof result.messages.message === 'object' && 'text' in result.messages.message) {
          errorMessages = result.messages.message.text;
        } else {
          errorMessages = 'Unknown error';
        }
        throw new Error(`Authorize.net API error: ${errorMessages}`);
      }

      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Authorize.net API Error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data) {
          const responseData = error.response.data;
          
          if (responseData.deleteCustomerPaymentProfileResponse?.messages) {
            const messages = responseData.deleteCustomerPaymentProfileResponse.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          if (responseData.messages) {
            const messages = responseData.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
        }
        
        throw new Error(`Failed to delete customer payment profile: ${getErrorMessage(error)}`);
      }
      throw error;
    }
  }

  /**
   * Cancel a subscription
   * @param subscriptionId Subscription ID to cancel
   * @returns Success status
   */
  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    const request = {
      merchantAuthentication: {
        name: this.apiLoginId,
        transactionKey: this.transactionKey,
      },
      subscriptionId: subscriptionId,
    };

    try {
      const requestBody = {
        ARBCancelSubscriptionRequest: request,
      };
      
      // Log the request for debugging
      console.log('Authorize.net Cancel Subscription API Request:', JSON.stringify(requestBody, null, 2));
      
      const response = await this.axiosInstance.post(
        this.apiEndpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      // Log the response for debugging
      console.log('Authorize.net Cancel Subscription API Response:', JSON.stringify(response.data, null, 2));

      const responseData = response.data;
      let result: any;

      if (responseData.ARBCancelSubscriptionResponse) {
        result = responseData.ARBCancelSubscriptionResponse;
      } else if (responseData.messages) {
        result = responseData;
      } else {
        throw new Error('Unexpected response structure from Authorize.net API');
      }

      if (!result.messages) {
        throw new Error('Response missing messages field');
      }

      if (result.messages.resultCode !== 'Ok') {
        let errorMessages: string;
        if (Array.isArray(result.messages.message)) {
          errorMessages = result.messages.message.map((m: { text: string }) => m.text).join(', ');
        } else if (result.messages.message && typeof result.messages.message === 'object' && 'text' in result.messages.message) {
          errorMessages = result.messages.message.text;
        } else {
          errorMessages = 'Unknown error';
        }
        throw new Error(`Authorize.net API error: ${errorMessages}`);
      }

      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Authorize.net API Error:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data) {
          const responseData = error.response.data;
          
          if (responseData.ARBCancelSubscriptionResponse?.messages) {
            const messages = responseData.ARBCancelSubscriptionResponse.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
          
          if (responseData.messages) {
            const messages = responseData.messages;
            let errorTexts: string;
            if (Array.isArray(messages.message)) {
              errorTexts = messages.message.map((m: { text: string }) => m.text).join(', ');
            } else if (messages.message && typeof messages.message === 'object' && 'text' in messages.message) {
              errorTexts = (messages.message as { text: string }).text;
            } else {
              errorTexts = 'Unknown error';
            }
            throw new Error(`Authorize.net API error: ${errorTexts}`);
          }
        }
        
        throw new Error(`Failed to cancel subscription: ${getErrorMessage(error)}`);
      }
      throw error;
    }
  }
}
