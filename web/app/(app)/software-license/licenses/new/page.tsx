import { notFound } from "next/navigation"
import { LicenseCreateForm } from "@/app/(app)/software-license/licenses/_components/license-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageLicenses } from "@/lib/license/can-manage-licenses"

export const metadata = { title: "ライセンス登録" }

/** ライセンス登録画面。license:manage が無ければ notFound。 */
export default async function LicenseNewPage() {
  const me = await getMe()

  if (me instanceof Error || canManageLicenses(me.permissions) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="ライセンスを登録">
        <BackButton href="/software-license/licenses" label="一覧に戻る" />
      </PageHeader>

      <Card className="gap-0">
        <div className="p-8">
          <LicenseCreateForm />
        </div>
      </Card>
    </div>
  )
}
