/**
 * Notification Token Storage
 * 
 * In-memory storage for Farcaster notification tokens
 * In production, replace with Redis, PostgreSQL, or other persistent storage
 */

interface NotificationTokenData {
  fid: number;
  url: string;
  token: string;
  addedAt: Date;
}

// In-memory storage
const notificationTokens = new Map<string, NotificationTokenData>();

/**
 * Save or update a notification token for a user
 */
export function saveNotificationToken(
  fid: number,
  url: string,
  token: string
): void {
  const key = `${fid}`;
  notificationTokens.set(key, {
    fid,
    url,
    token,
    addedAt: new Date(),
  });
  console.log(`[TokenStorage] Saved token for FID ${fid}`);
}

/**
 * Get notification token for a specific user
 */
export function getNotificationToken(
  fid: number
): NotificationTokenData | undefined {
  return notificationTokens.get(`${fid}`);
}

/**
 * Remove notification token for a user
 */
export function removeNotificationToken(fid: number): void {
  notificationTokens.delete(`${fid}`);
  console.log(`[TokenStorage] Removed token for FID ${fid}`);
}

/**
 * Get all notification tokens
 */
export function getAllNotificationTokens(): NotificationTokenData[] {
  return Array.from(notificationTokens.values());
}

/**
 * Get total count of stored tokens
 */
export function getTokenCount(): number {
  return notificationTokens.size;
}

/**
 * Check if a token exists for a user
 */
export function hasNotificationToken(fid: number): boolean {
  return notificationTokens.has(`${fid}`);
}

/**
 * Clear all tokens (use with caution!)
 */
export function clearAllTokens(): void {
  const count = notificationTokens.size;
  notificationTokens.clear();
  console.log(`[TokenStorage] Cleared ${count} tokens`);
}

