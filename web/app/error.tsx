"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

// ルートセグメントのエラーバウンダリ。未ハンドル例外時に汎用 500 でなく回復導線を出す。
export default function RootError(props: Props) {
  return (
    <main className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">問題が発生しました</h1>

        <p className="text-sm text-muted-foreground">
          処理中にエラーが発生しました。お手数ですが、もう一度お試しください。
        </p>

        {props.error.digest !== undefined ? (
          <p className="text-xs text-muted-foreground">エラーID: {props.error.digest}</p>
        ) : null}
      </div>

      <div className="flex gap-3">
        <Button onClick={props.reset}>再試行</Button>

        <Button variant="outline" render={<Link href="/" />}>
          ホームへ戻る
        </Button>
      </div>
    </main>
  )
}
