import { redirect } from "next/navigation"

// ルートは保護領域のトップ (/dashboard) へ送る。未認証なら proxy が /login へ戻す。
export default function Home() {
  redirect("/dashboard")
}
