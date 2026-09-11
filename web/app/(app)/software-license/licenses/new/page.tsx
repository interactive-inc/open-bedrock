import { notFound } from "next/navigation"
import Link from "next/link"
import { LicenseCreateForm } from "@/app/(app)/software-license/licenses/_components/license-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FetchError } from "@/components/fetch-error"
import { getEmployeeChoices } from "@/lib/api/get-employee-choices"
import { getMe } from "@/lib/api/get-me"
import { canManageLicenses } from "@/lib/license/can-manage-licenses"

export const metadata = { title: "ライセンス登録" }

/** ライセンス登録画面。license:manage が無ければ notFound。 */
export default async function LicenseNewPage(props: {
  searchParams: Promise<{ q?: string; offset?: string }>
}) {
  const me = await getMe()

  if (me instanceof Error || canManageLicenses(me.permissions) === false) {
    notFound()
  }

  const commandId = crypto.randomUUID()
  const query = await props.searchParams
  const search = query.q?.trim() ?? ""
  const offset = Number(query.offset ?? "0")
  if (search.length > 200 || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000)
    notFound()
  const directory = await getEmployeeChoices(search, offset)
  if (directory instanceof Error)
    return <FetchError message="管理担当の職員を取得できませんでした" />

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="ライセンスを登録">
        <BackButton href="/software-license/licenses" label="一覧に戻る" />
      </PageHeader>

      <form action="/software-license/licenses/new">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="owner-search">管理担当の候補を検索</FieldLabel>
            <Input id="owner-search" name="q" defaultValue={search} maxLength={200} />
          </Field>
          <Field>
            <Button type="submit" variant="secondary">
              職員を検索
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <p>
        管理担当の候補 {directory.total}件中 {directory.employees.length}
        件を表示しています。候補の検索後に契約内容を入力してください。
      </p>
      <nav aria-label="管理担当候補のページ送り" className="flex gap-4">
        {offset > 0 ? (
          <Link
            href={`/software-license/licenses/new?q=${encodeURIComponent(search)}&offset=${Math.max(0, offset - 50)}`}
          >
            前の50件
          </Link>
        ) : null}
        {offset + 50 < directory.total && offset < 10000 ? (
          <Link
            href={`/software-license/licenses/new?q=${encodeURIComponent(search)}&offset=${Math.min(10000, offset + 50)}`}
          >
            次の50件
          </Link>
        ) : null}
      </nav>

      <Card className="gap-0">
        <div className="p-8">
          <LicenseCreateForm
            key={`${search}:${offset}`}
            commandId={commandId}
            employees={directory.employees}
          />
        </div>
      </Card>
    </div>
  )
}
