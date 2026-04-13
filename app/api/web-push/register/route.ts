import { getCurrentUser } from "@/utils/auth/server";
import { getDB } from "@/utils/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await req.json();

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const { endpoint, keys: { p256dh, auth } } = subscription;
    const userAgent = req.headers.get('user-agent') || '';

    const db = await getDB();

    // Cek apakah endpoint ini sudah ada
    const existing = await db
      .prepare('SELECT id FROM web_push_subscriptions WHERE endpoint = ?')
      .bind(endpoint)
      .first();

    if (existing) {
      // Update jika diperlukan (misalnya auth keys berubah atau ganti akun)
      await db
        .prepare('UPDATE web_push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, user_agent = ?, updated_at = datetime("now") WHERE endpoint = ?')
        .bind(user.id, p256dh, auth, userAgent, endpoint)
        .run();
    } else {
      // Insert baru
      await db
        .prepare('INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?, ?)')
        .bind(user.id, endpoint, p256dh, auth, userAgent)
        .run();
    }

    return NextResponse.json({ success: true, message: "Subscription saved!" });
  } catch (error: any) {
    console.error("Web Push Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { endpoint } = await req.json();
    
    if (!endpoint) {
      return NextResponse.json({ error: "No endpoint provided" }, { status: 400 });
    }

    const db = await getDB();
    await db
      .prepare('DELETE FROM web_push_subscriptions WHERE endpoint = ? AND user_id = ?')
      .bind(endpoint, user.id)
      .run();

    return NextResponse.json({ success: true, message: "Subscription removed!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
