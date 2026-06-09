import Link from "next/link"
import { Button } from "@/components/ui/button"

// 該当 URL が存在しない場合のルート 404 ページ。
export default function RootNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">ページが見つかりません</h1>

        <p className="text-sm text-muted-foreground">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
      </div>

      <Button render={<Link href="/dashboard" />}>ホームへ戻る</Button>
    </main>
  )
}
