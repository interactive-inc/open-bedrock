import { Gift, Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MyThanksRedemptionsList } from "@/app/(app)/my/thanks/_components/my-thanks-redemptions-list"
import { MyThanksSentList } from "@/app/(app)/my/thanks/_components/my-thanks-sent-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata = { title: "サンクス履歴" }

/**
 * 自分のサンクス送信履歴と交換履歴・申請状況をまとめて確認する画面。
 * 全社公開のタイムラインは /thanks/thanks に分離する。
 */
export default function MyThanksPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="サンクス履歴"
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/thanks/rewards" />}>
              <Gift />
              景品を見る
            </Button>

            <Button nativeButton={false} render={<Link href="/thanks/thanks/send" />}>
              <Plus />
              感謝を送る
            </Button>
          </>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">送信履歴</h2>

        <Suspense fallback={<ListSkeleton rows={5} />}>
          <MyThanksSentList />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">交換履歴・申請状況</h2>

        <Suspense fallback={<ListSkeleton rows={5} />}>
          <MyThanksRedemptionsList />
        </Suspense>
      </section>
    </div>
  )
}
