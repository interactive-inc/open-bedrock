import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { TablePagination } from "@/components/table-pagination"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getLicenseList } from "@/lib/api/get-license-list"
import { LicenseCancelButton } from "@/app/(app)/software-license/licenses/_components/license-cancel-button"

const PAGE_SIZE = 20

type Props = {
  offset: number
  canManage: boolean
}

/** GET /software-licenses を認証付きで取得し、更新期限が近い順のライセンス台帳テーブルを描画する非同期 RSC。 */
export async function LicenseList(props: Props) {
  const result = await getLicenseList({ limit: PAGE_SIZE, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="ライセンス台帳の取得に失敗しました" />
  }

  if (result.data.length === 0) {
    return (
      <EmptyState
        title="ライセンスはまだありません"
        description="利用中の SaaS やソフトウェアを登録すると、更新期限を一覧で追えます。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <Table aria-label="ライセンス台帳">
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>ベンダ</TableHead>
              <TableHead>区分</TableHead>
              <TableHead>座席</TableHead>
              <TableHead>更新期限</TableHead>
              <TableHead>状態</TableHead>
              {props.canManage ? <TableHead>操作</TableHead> : null}
            </TableRow>
          </TableHeader>

          <TableBody>
            {result.data.map((license) => (
              <TableRow key={license.id}>
                <TableCell>{license.name}</TableCell>

                <TableCell>{license.vendor ?? "-"}</TableCell>

                <TableCell>{license.category ?? "-"}</TableCell>

                <TableCell>{license.seats !== null ? String(license.seats) : "-"}</TableCell>

                <TableCell>{license.renewal_deadline ?? "-"}</TableCell>

                <TableCell>
                  {license.status === "cancelled" ? (
                    <Badge variant="outline">解約済み</Badge>
                  ) : (
                    <Badge variant="secondary">利用中</Badge>
                  )}
                </TableCell>

                {props.canManage ? (
                  <TableCell>
                    {license.status === "active" ? (
                      <LicenseCancelButton id={license.id} name={license.name} />
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        pathname="/software-license/licenses"
        total={result.total}
        limit={PAGE_SIZE}
        offset={props.offset}
      />
    </div>
  )
}
