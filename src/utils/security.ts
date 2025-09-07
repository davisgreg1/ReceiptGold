import 'react-native-get-random-values';

/**
 * Generate a secure random token for team invitations
 */
export function generateSecureToken(length: number = 32): string {
  // Use crypto.getRandomValues (available after importing react-native-get-random-values)
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a unique team invitation ID
 */
export function generateTeamInvitationId(): string {
  return `invite_${Date.now()}_${generateSecureToken(16)}`;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.toLowerCase());
}

/**
 * Generate a secure team member ID
 */
export function generateTeamMemberId(): string {
  return `member_${Date.now()}_${generateSecureToken(16)}`;
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Hash sensitive data for logging (partial email hiding)
 */
export function hashEmail(email: string): string {
  if (!email || email.length < 3) return '***';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  
  const username = parts[0];
  const domain = parts[1];
  
  const maskedUsername = username.length > 2 
    ? username.substring(0, 2) + '*'.repeat(Math.max(username.length - 2, 1))
    : username;
    
  return `${maskedUsername}@${domain}`;
}