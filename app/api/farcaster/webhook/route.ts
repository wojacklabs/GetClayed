import { NextRequest, NextResponse } from 'next/server';
import {
  saveNotificationToken,
  removeNotificationToken,
  getTokenCount,
} from '@/lib/notificationTokenStorage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[Webhook] Received event:', body);

    // Extract event data (검증 없이 바로 사용)
    const event = body.event;
    const notificationDetails = body.notificationDetails;
    const fid = body.untrustedData?.fid || body.fid;

    if (!fid) {
      console.error('[Webhook] Missing FID in event');
      return NextResponse.json(
        { error: 'Missing FID' },
        { status: 400 }
      );
    }

    // Handle different event types
    switch (event) {
      case 'miniapp_added':
        console.log(`[Webhook] Mini App added by FID ${fid}`);
        
        // If notification details are provided, save the token
        if (notificationDetails) {
          saveNotificationToken(
            fid,
            notificationDetails.url,
            notificationDetails.token
          );
        }
        break;

      case 'miniapp_removed':
        console.log(`[Webhook] Mini App removed by FID ${fid}`);
        removeNotificationToken(fid);
        break;

      case 'notifications_enabled':
        console.log(`[Webhook] Notifications enabled by FID ${fid}`);
        
        if (notificationDetails) {
          saveNotificationToken(
            fid,
            notificationDetails.url,
            notificationDetails.token
          );
        }
        break;

      case 'notifications_disabled':
        console.log(`[Webhook] Notifications disabled by FID ${fid}`);
        removeNotificationToken(fid);
        break;

      default:
        console.log(`[Webhook] Unknown event type: ${event}`);
    }

    // Log current state (for debugging)
    console.log(`[Webhook] Current notification tokens: ${getTokenCount()}`);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

