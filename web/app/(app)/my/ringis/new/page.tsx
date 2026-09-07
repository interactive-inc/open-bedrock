import Link from "next/link"
import { getRingiProcedure } from "@/lib/api/get-ringi-procedure"
import { FetchError } from "@/components/fetch-error"
import { RingiCreateForm } from "@/app/(app)/my/ringis/_components/ringi-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "稟議の新規起案" }

/**
 * 稟議の新規起案。フォーム単機能のページとして、一覧から独立させる。
 */
export default async function NewRingiPage() {
  const procedure = await getRingiProcedure()
  if (procedure instanceof Error) return <FetchError message={procedure.message} />
  if (procedure.workflow === null)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="稟議の承認規程が未設定です" />
        <p>承認規程の設定後に稟議を提出できます。</p>
        <Link href="/ringi/procedure">承認規程の設定へ</Link>
      </div>
    )
  const requestKey = crypto.randomUUID()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="稟議を起案">
        <BackButton href="/my/ringis" label="一覧に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <RingiCreateForm requestKey={requestKey} />
        </CardContent>
      </Card>
    </div>
  )
}
