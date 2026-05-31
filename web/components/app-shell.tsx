"use client";

import { AppHeader } from "@/components/app-header";
import { SidebarNav } from "@/components/sidebar-nav";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarProvider,
} from "@/components/ui/sidebar";
import type { MeResponse } from "@/lib/api/types/auth-types";

type Props = {
	children: React.ReactNode;
	currentUser: MeResponse;
	onLogout: () => void;
	unreadNotificationCount: number;
};

// サイドバー開閉状態を持つアプリ全体シェル。md 以上は固定表示、sm 以下は offcanvas トグル。
// onLogout は layout (RSC) から渡された Server Action。
export function AppShell(props: Props) {
	const deptLabel = props.currentUser.dept_name ?? "所属未設定";

	return (
		<SidebarProvider>
			<Sidebar collapsible="offcanvas">
				<SidebarHeader>
					<div className="flex flex-col gap-0.5 px-2 py-1">
						<span className="text-sm font-semibold">open-karte</span>

						<span className="text-xs text-muted-foreground">{deptLabel}</span>
					</div>
				</SidebarHeader>

				<SidebarContent>
					<SidebarNav unreadNotificationCount={props.unreadNotificationCount} />
				</SidebarContent>

				<SidebarFooter>
					<span className="px-2 py-1 text-xs text-muted-foreground">
						{props.currentUser.role}
					</span>
				</SidebarFooter>
			</Sidebar>

			<SidebarInset>
				<AppHeader currentUser={props.currentUser} onLogout={props.onLogout} />

				<main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
					{props.children}
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
