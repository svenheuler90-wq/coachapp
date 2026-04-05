import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey);

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidSubject = process.env.VAPID_SUBJECT!;

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

async function sendToUserIds(userIds: string[], payload: PushPayload) {
  if (!userIds.length) return;

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("*")
    .in("user_id", userIds);

  if (error || !subscriptions?.length) return;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      );
    } catch (err: any) {
      const statusCode = err?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      type,
      athleteId,
      coachId,
      senderRole,
      senderUserId,
      broadcast = false,
      title,
      message,
      url = "/",
    } = body ?? {};

    let targetUserIds: string[] = [];

    if (broadcast) {
      const { data: athletes } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "athlete");

      targetUserIds = (athletes ?? []).map((a: any) => a.id);
    } else if (type === "message") {
      if (senderRole === "coach" && athleteId) {
        targetUserIds = [athleteId];
      }

      if (senderRole === "athlete" && athleteId) {
        const { data: athlete } = await admin
          .from("profiles")
          .select("coach_id")
          .eq("id", athleteId)
          .single();

        const coachIds: string[] = [];

        if (athlete?.coach_id) coachIds.push(athlete.coach_id);

        const { data: adminCoach } = await admin
          .from("profiles")
          .select("id")
          .eq("role", "admin");

        for (const c of adminCoach ?? []) {
          if (!coachIds.includes(c.id)) coachIds.push(c.id);
        }

        targetUserIds = coachIds;
      }
    } else if (type === "checkin") {
      if (athleteId) {
        const { data: athlete } = await admin
          .from("profiles")
          .select("coach_id")
          .eq("id", athleteId)
          .single();

        const coachIds: string[] = [];

        if (athlete?.coach_id) coachIds.push(athlete.coach_id);

        const { data: adminCoach } = await admin
          .from("profiles")
          .select("id")
          .eq("role", "admin");

        for (const c of adminCoach ?? []) {
          if (!coachIds.includes(c.id)) coachIds.push(c.id);
        }

        targetUserIds = coachIds;
      }
    } else if (type === "plan") {
      if (athleteId) {
        targetUserIds = [athleteId];
      }
    }

    if (senderUserId) {
      targetUserIds = targetUserIds.filter((id) => id !== senderUserId);
    }

    const payload: PushPayload = {
      title: title || "CoachFlow",
      body: message || "Neue Benachrichtigung",
      url,
    };

    await sendToUserIds(targetUserIds, payload);

    return NextResponse.json({ ok: true, sentTo: targetUserIds });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Serverfehler" },
      { status: 500 }
    );
  }
}