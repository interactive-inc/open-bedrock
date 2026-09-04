import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RegulationManageActions } from "@/app/(app)/regulation/regulations/[regulation]/_components/regulation-manage-actions"
import { getRegulationDetail } from "@/lib/api/get-regulation-detail"
import { getMe } from "@/lib/api/get-me"
import { canManageRegulations } from "@/lib/regulation/can-manage-regulations"
import { handleDetailError } from "@/lib/api/handle-detail-error"

export const metadata = { title: "規程詳細" }

type Props = {
  params: Promise<{ regulation: string }>
}

/** /regulations/:code 詳細画面。最新版の本文と版履歴を表示し、管理者は新版追加・アーカイブができる。 */
export default async function RegulationDetailPage(props: Props) {
  const params = await props.params

  const regulation = await getRegulationDetail(params.regulation)

  if (regulation instanceof Error) {
    handleDetailError(regulation)
  }

  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageRegulations(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={regulation.title}>
        <BackButton href="/regulation/regulations" label="一覧に戻る" />
      </PageHeader>

      {canManage ? (
        <RegulationManageActions code={regulation.code} status={regulation.status} />
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          最新版
          {regulation.latest_version === null
            ? ""
            : `（v${regulation.latest_version.version} / 施行日 ${regulation.latest_version.effective_on}）`}
        </h2>

        <Card className="gap-0">
          <article className="whitespace-pre-wrap p-6 text-sm leading-relaxed">
            {regulation.latest_version === null
              ? "版がありません"
              : regulation.latest_version.body_md}
          </article>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">改定履歴</h2>

        <div className="overflow-x-auto">
          <Table aria-label="規程の改定履歴">
            <TableHeader>
              <TableRow>
                <TableHead>版</TableHead>
                <TableHead>施行日</TableHead>
                <TableHead>備考</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {regulation.versions.map((version) => (
                <TableRow key={version.id}>
                  <TableCell>v{version.version}</TableCell>

                  <TableCell>{version.effective_on}</TableCell>

                  <TableCell>{version.note ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
