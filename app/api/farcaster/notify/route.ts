import { NextRequest, NextResponse } from 'next/server';
import {
  getNotificationToken,
  getAllNotificationTokens,
} from '@/lib/notificationTokenStorage';

interface SendNotificationRequest {
  fid?: number; // If provided, send to specific user. Otherwise send to all.
  title: string;
  body: string;
  targetUrl: string;
  notificationId: string;
}

interface NotificationPayload {
  notificationId: string;
  title: string;
  body: string;
  targetUrl: string;
  tokens: string[];
}

export async function POST(request: NextRequest) {
  try {
    const {
      fid,
      title,
      body,
      targetUrl,
      notificationId,
    }: SendNotificationRequest = await request.json();

    // Validate required fields
    if (!title || !body || !targetUrl || !notificationId) {
      return NextResponse.json(
        { error: 'Missing required fields: title, body, targetUrl, notificationId' },
        { status: 400 }
      );
    }

    // Validate field lengths
    if (title.length > 32) {
      return NextResponse.json(
        { error: 'Title must be 32 characters or less' },
        { status: 400 }
      );
    }

    if (body.length > 128) {
      return NextResponse.json(
        { error: 'Body must be 128 characters or less' },
        { status: 400 }
      );
    }

    if (targetUrl.length > 1024) {
      return NextResponse.json(
        { error: 'Target URL must be 1024 characters or less' },
        { status: 400 }
      );
    }

    if (notificationId.length > 128) {
      return NextResponse.json(
        { error: 'Notification ID must be 128 characters or less' },
        { status: 400 }
      );
    }

    // Get tokens to send to
    let tokensToSend: Array<{ url: string; token: string; fid: number }> = [];

    if (fid) {
      // Send to specific user
      const tokenData = getNotificationToken(fid);
      if (!tokenData) {
        return NextResponse.json(
          { error: `No notification token found for FID ${fid}` },
          { status: 404 }
        );
      }
      tokensToSend = [tokenData];
    } else {
      // Send to all users
      tokensToSend = getAllNotificationTokens();
      
      if (tokensToSend.length === 0) {
        return NextResponse.json(
          { error: 'No notification tokens available' },
          { status: 404 }
        );
      }
    }

    // Group tokens by URL (different Farcaster clients may have different URLs)
    const tokensByUrl = new Map<string, string[]>();
    tokensToSend.forEach(({ url, token }) => {
      if (!tokensByUrl.has(url)) {
        tokensByUrl.set(url, []);
      }
      tokensByUrl.get(url)!.push(token);
    });

    // Send notifications in batches (max 100 tokens per request)
    const results = {
      total: tokensToSend.length,
      successful: 0,
      failed: 0,
      rateLimited: 0,
      errors: [] as string[],
    };

    for (const [url, tokens] of tokensByUrl.entries()) {
      // Split into batches of 100
      const batches = [];
      for (let i = 0; i < tokens.length; i += 100) {
        batches.push(tokens.slice(i, i + 100));
      }

      for (const batch of batches) {
        const payload: NotificationPayload = {
          notificationId,
          title,
          body,
          targetUrl,
          tokens: batch,
        };

        try {
          console.log(`[Notify] Sending to ${batch.length} tokens at ${url}`);
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Notify] Failed to send notification: ${response.status} ${errorText}`);
            results.failed += batch.length;
            results.errors.push(`Failed for ${batch.length} tokens: ${response.status}`);
            continue;
          }

          const result = await response.json();
          
          results.successful += result.successfulTokens?.length || 0;
          results.failed += result.invalidTokens?.length || 0;
          results.rateLimited += result.rateLimitedTokens?.length || 0;

          console.log(`[Notify] Sent successfully to ${result.successfulTokens?.length || 0} tokens`);
          
          // Remove invalid tokens from storage
          if (result.invalidTokens && result.invalidTokens.length > 0) {
            console.log(`[Notify] ${result.invalidTokens.length} invalid tokens detected`);
            // In a real implementation, you'd remove these from the database
          }
        } catch (error: any) {
          console.error('[Notify] Error sending notification:', error);
          results.failed += batch.length;
          results.errors.push(error.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('[Notify] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Example usage endpoint
export async function GET() {
  return NextResponse.json({
    message: 'Farcaster Notification API',
    usage: {
      endpoint: '/api/farcaster/notify',
      method: 'POST',
      body: {
        fid: 'number (optional - if not provided, sends to all users)',
        title: 'string (max 32 chars)',
        body: 'string (max 128 chars)',
        targetUrl: 'string (max 1024 chars)',
        notificationId: 'string (max 128 chars)',
      },
      example: {
        title: 'New Creation! 🎨',
        body: 'Check out the latest 3D artwork',
        targetUrl: 'https://getclayed.io/project/123',
        notificationId: 'new-creation-123',
      },
    },
  });
}

