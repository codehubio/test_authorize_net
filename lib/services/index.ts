import { AuthorizeNetService } from './authorizeNet';

// Singleton instance
let authorizeNetServiceInstance: AuthorizeNetService | null = null;

export function getAuthorizeNetService(): AuthorizeNetService {
  if (!authorizeNetServiceInstance) {
    try {
      authorizeNetServiceInstance = new AuthorizeNetService();
    } catch (error) {
      console.error('Failed to initialize Authorize.net service:', error);
      throw error;
    }
  }
  return authorizeNetServiceInstance;
}
