import { createClient } from "@/lib/api/hc-client";
import type { NotificationResponse } from "@/lib/api/types/notification-types";

// GET /notifications/me。自分宛ての通知一覧（新着順）を取得する。
export async function getMyNotifications(): Promise<
	Array<NotificationResponse> | Error
> {
	const client = await createClient();

	const response = await client.notifications.me.$get({ query: {} });

	if (response.status >= 400) {
		return new Error("failed to load my notifications");
	}

	return response.json();
}
