import Link from "next/link"
import { z } from "zod"
import { notFound } from "next/navigation"
import { AssignmentForm } from "@/app/(app)/software-license/licenses/[license]/_components/assignment-form"
import { BackButton } from "@/components/back-button"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { getEmployeeChoices } from "@/lib/api/get-employee-choices"
import { getLicense } from "@/lib/api/get-license"
import { getMe } from "@/lib/api/get-me"
import { canManageLicenses } from "@/lib/license/can-manage-licenses"

type Props = {
  params: Promise<{ license: string }>
  searchParams: Promise<{ q?: string; offset?: string }>
}
export const metadata = { title: "利用開始を記録" }

/** 会社の在籍職員を検索し、利用するサービスに紐付ける。 */
export default async function LicenseAssignmentPage(props: Props) {
  const viewer = await getMe()
  if (viewer instanceof Error || !canManageLicenses(viewer.permissions)) notFound()
  const params = await props.params
  const query = await props.searchParams
  const id = Number(params.license)
  const offset = Number(query.offset ?? "0")
  const search = query.q?.trim() ?? ""
  const location = z
    .object({
      id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      offset: z.number().int().min(0).max(10000),
      search: z.string().max(200),
    })
    .safeParse({ id, offset, search })
  if (!location.success) notFound()
  const responses = await Promise.all([getLicense(id), getEmployeeChoices(search, offset)])
  const license = responses[0]
  const directory = responses[1]
  if (license instanceof Error || directory instanceof Error)
    return <FetchError message="サービスまたは職員を取得できませんでした" />
  const path = `/software-license/licenses/${id}`
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="利用開始を記録">
        <BackButton href={path} label="利用者一覧に戻る" />
      </PageHeader>
      <p>
        {license.name} · 現在のプラン: {license.plan_name ?? "未設定"}
      </p>
      <p>
        登録時のプランを利用履歴に残します。外部サービスのアカウント作成・契約変更は行いません。
      </p>
      {license.status !== "active" ? (
        <p>解約済みのサービスには利用者を追加できません。</p>
      ) : (
        <>
          <form action={`${path}/assign`}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="employee-search">職員を検索</FieldLabel>
                <Input id="employee-search" name="q" defaultValue={search} maxLength={200} />
              </Field>
              <Field>
                <Button type="submit" variant="secondary">
                  検索
                </Button>
              </Field>
            </FieldGroup>
          </form>
          <p>
            {directory.total}件中 {directory.employees.length}件を表示しています。
          </p>
          <nav aria-label="職員のページ送り" className="flex gap-4">
            {offset > 0 ? (
              <Link
                href={`${path}/assign?q=${encodeURIComponent(search)}&offset=${Math.max(0, offset - 50)}`}
              >
                前の50件
              </Link>
            ) : null}
            {offset + 50 < directory.total && offset < 10000 ? (
              <Link
                href={`${path}/assign?q=${encodeURIComponent(search)}&offset=${Math.min(10000, offset + 50)}`}
              >
                次の50件
              </Link>
            ) : null}
          </nav>
          <AssignmentForm
            key={`${search}:${offset}`}
            licenseId={id}
            employees={directory.employees}
          />
        </>
      )}
    </div>
  )
}
