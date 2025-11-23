/**
 * Farcaster Notification Helper
 * 
 * This module provides easy-to-use functions for sending Farcaster notifications
 * to users who have added the GetClayed Mini App.
 */

export interface NotificationOptions {
  /** FID of the user to notify. If not provided, notifies all users. */
  fid?: number;
  /** Title of the notification (max 32 chars) */
  title: string;
  /** Body text of the notification (max 128 chars) */
  body: string;
  /** URL to open when notification is clicked (max 1024 chars) */
  targetUrl: string;
  /** Unique ID for this notification (max 128 chars) */
  notificationId: string;
}

export interface NotificationResult {
  success: boolean;
  results?: {
    total: number;
    successful: number;
    failed: number;
    rateLimited: number;
    errors: string[];
  };
  error?: string;
}

/**
 * Send a Farcaster notification
 * 
 * @example
 * ```typescript
 * // Notify a specific user
 * await sendFarcasterNotification({
 *   fid: 123456,
 *   title: 'New Like! ❤️',
 *   body: 'Someone liked your creation',
 *   targetUrl: 'https://getclayed.io/project/abc',
 *   notificationId: 'like-abc-123'
 * });
 * 
 * // Notify all users
 * await sendFarcasterNotification({
 *   title: 'New Feature! 🎉',
 *   body: 'Check out our new 3D sculpting tools',
 *   targetUrl: 'https://getclayed.io',
 *   notificationId: 'feature-announcement-2024-11-17'
 * });
 * ```
 */
export async function sendFarcasterNotification(
  options: NotificationOptions
): Promise<NotificationResult> {
  try {
    const response = await fetch('/api/farcaster/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send notification',
    };
  }
}

/**
 * Notify a user about a new royalty payment
 */
export async function notifyRoyaltyPayment(
  fid: number,
  amount: string,
  projectId: string
): Promise<NotificationResult> {
  return sendFarcasterNotification({
    fid,
    title: `💰 Royalty: ${amount} ETH`,
    body: 'You received a new royalty payment!',
    targetUrl: `https://getclayed.io/project/${projectId}`,
    notificationId: `royalty-${projectId}-${Date.now()}`,
  });
}

/**
 * Notify a user about a new like on their project
 */
export async function notifyProjectLike(
  fid: number,
  projectId: string,
  likerName?: string
): Promise<NotificationResult> {
  const body = likerName
    ? `${likerName} liked your creation`
    : 'Someone liked your creation';

  return sendFarcasterNotification({
    fid,
    title: '❤️ New Like',
    body,
    targetUrl: `https://getclayed.io/project/${projectId}`,
    notificationId: `like-${projectId}-${Date.now()}`,
  });
}

/**
 * Notify all users about a new feature or announcement
 */
export async function broadcastAnnouncement(
  title: string,
  body: string,
  targetUrl: string = 'https://getclayed.io'
): Promise<NotificationResult> {
  return sendFarcasterNotification({
    title: title.slice(0, 32), // Ensure max length
    body: body.slice(0, 128), // Ensure max length
    targetUrl,
    notificationId: `announcement-${Date.now()}`,
  });
}

/**
 * Notify a user about a new comment on their project
 */
export async function notifyNewComment(
  fid: number,
  projectId: string,
  commenterName?: string
): Promise<NotificationResult> {
  const body = commenterName
    ? `${commenterName} commented on your project`
    : 'New comment on your project';

  return sendFarcasterNotification({
    fid,
    title: '💬 New Comment',
    body,
    targetUrl: `https://getclayed.io/project/${projectId}`,
    notificationId: `comment-${projectId}-${Date.now()}`,
  });
}

/**
 * Notify a user that their project was featured
 */
export async function notifyProjectFeatured(
  fid: number,
  projectId: string
): Promise<NotificationResult> {
  return sendFarcasterNotification({
    fid,
    title: '⭐ Featured!',
    body: 'Your creation was featured!',
    targetUrl: `https://getclayed.io/project/${projectId}`,
    notificationId: `featured-${projectId}`,
  });
}

