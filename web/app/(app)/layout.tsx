import { redirect } from "next/navigation";
import { logoutAction } from "@/app/(app)/actions/logout";
import { AppShell } from "@/components/app-shell";
import { getMe } from "@/lib/api/get-me";
import { getMyUnreadCount } from "@/lib/api/get-my-unread-count";

type Props = {
	children: React.ReactNode;
};

// 保護済みページ共通の layout。/me で本人を取得し、未認証なら /login へ戻す。
// 取得した本人情報・未読通知件数と logout Server Action を AppShell (Client) に渡す。
export default async function AppLayout(props: Props) {
	const currentUser = await getMe();

	if (currentUser instanceof Error) {
		redirect("/login");
	}

	const unreadCount = await getMyUnreadCount();

	const unreadNotificationCount =
		unreadCount instanceof Error ? 0 : unreadCount.count;

	return (
		<AppShell
			currentUser={currentUser}
			onLogout={logoutAction}
			unreadNotificationCount={unreadNotificationCount}
		>
			{props.children}
		</AppShell>
	);
}
