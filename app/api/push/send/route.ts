export const runtime = "nodejs";

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
  type?: string;
};

type PushRequestBody = {
  type:
    | "message_from_coach"
    | "message_from_athlete"
    | "plan_uploaded"
    | "checkin_created"
    | "broadcast_message"
    | "checkin_due_today"
    | "checkin_overdue";
  athleteId?: string | null;
  senderUserId?: string | null;
  title?: string;
  message?: string;
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

async function getRecipientCoachIdsForAthlete(athleteId: string) {
  const coachIds: string[] = [];

  const { data: athlete } = await admin
    .from("profiles")
    .select("coach_id")
    .eq("id", athleteId)
    .single();

  if (athlete?.coach_id) coachIds.push(athlete.coach_id);

  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  for (const a of admins ?? []) {
    if (!coachIds.includes(a.id)) coachIds.push(a.id);
  }

  return coachIds;
}

async function buildTargets(body: PushRequestBody) {
  const { type, athleteId, senderUserId } = body;
  let targetUserIds: string[] = [];

  if (type === "message_from_coach" && athleteId) {
    targetUserIds = [athleteId];
  }

  if (type === "message_from_athlete" && athleteId) {
    targetUserIds = await getRecipientCoachIdsForAthlete(athleteId);
  }

  if (type === "plan_uploaded" && athleteId) {
    targetUserIds = [athleteId];
  }

  if (type === "checkin_created" && athleteId) {
    targetUserIds = await getRecipientCoachIdsForAthlete(athleteId);
  }

  if (type === "broadcast_message") {
    const { data: athletes } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "athlete");

    targetUserIds = (athletes ?? []).map((a: any) => a.id);
  }

  if (type === "checkin_due_today" && athleteId) {
    targetUserIds = [athleteId];
  }

  if (type === "checkin_overdue" && athleteId) {
    targetUserIds = [athleteId];
  }

  if (senderUserId) {
    targetUserIds = targetUserIds.filter((id) => id !== senderUserId);
  }

  return [...new Set(targetUserIds)];
}

function buildPayload(body: PushRequestBody): PushPayload {
  const { type, title, message, url = "/" } = body;

  if (title && message) {
    return {
      title,
      body: message,
      url,
      type,
    };
  }

  switch (type) {
    case "message_from_coach":
      return {
        title: "Neue Nachricht vom Coach",
        body: message || "Du hast eine neue Nachricht erhalten.",
        url,
        type,
      };

    case "message_from_athlete":
      return {
        title: "Neue Nachricht vom Athleten",
        body: message || "Ein Athlet hat dir geschrieben.",
        url,
        type,
      };

    case "plan_uploaded":
      return {
        title: "Neuer Plan verfügbar",
        body: message || "Ein neuer Plan wurde hochgeladen.",
        url,
        type,
      };

    case "checkin_created":
      return {
        title: "Neuer Check-in eingegangen",
        body: message || "Ein Athlet hat einen neuen Check-in eingereicht.",
        url,
        type,
      };

    case "broadcast_message":
      return {
        title: "Neue Nachricht",
        body: message || "Es gibt eine neue Nachricht an alle.",
        url,
        type,
      };

    case "checkin_due_today":
      return {
        title: "Check-in heute fällig",
        body: message || "Dein Check-in ist heute fällig.",
        url,
        type,
      };

    case "checkin_overdue":
      return {
        title: "Check-in überfällig",
        body: message || "Dein Check-in ist überfällig.",
        url,
        type,
      };

    default:
      return {
        title: "CoachFlow",
        body: message || "Neue Benachrichtigung",
        url,
        type,
      };
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PushRequestBody;

    const targetUserIds = await buildTargets(body);
    const payload = buildPayload(body);

    await sendToUserIds(targetUserIds, payload);

    return NextResponse.json({
      ok: true,
      sentTo: targetUserIds,
      payload,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Serverfehler" },
      { status: 500 }
    );
  }
}