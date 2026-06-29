"use client"

import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

/**
 * RSC でのサーバー取得失敗を表示する統一コンポーネント。
 * 各ページで `<p className="text-sm text-destructive">...の取得に失敗しました</p>` を書き散らさないようまとめる。
 * 一時的なエラーの可能性に備えて router.refresh() で再取得する導線を持つ。
 */
type Props = {
  message: string
}

export function FetchError(props: Props) {
  const router = useRouter()

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
    >
      <p className="text-sm text-destructive">{props.message}</p>

      <Button variant="outline" size="sm" onClick={() => router.refresh()}>
        <RefreshCw className="mr-2 size-4" />
        再読み込み
      </Button>
    </div>
  )
}
