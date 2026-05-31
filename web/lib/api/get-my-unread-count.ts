import { createClient } from "@/lib/api/hc-client";
import type { UnreadCountResponse } from "@/lib/api/types/notification-types";

// GET /notifications/me/unread-count。自分宛ての未読通知件数を取得する。
export async function getMyUnreadCount(): Promise<UnreadCountResponse | Error> {
	const client = await createClient();

	const response = await client.notifications.me["unread-count"].$get();

	if (response.status >= 400) {
		return new Error("failed to load unread count");
	}

	return response.json();
}
