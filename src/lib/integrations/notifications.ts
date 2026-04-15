export interface NotificationPayload {
  channel: "SMS" | "EMAIL" | "PUSH" | "IN_APP";
  recipient: string;
  title: string;
  body: string;
}

export async function sendNotification(payload: NotificationPayload) {
  return {
    delivered: true,
    provider: payload.channel === "SMS" ? "mock-sms" : "mock-notifier",
    payload
  };
}
