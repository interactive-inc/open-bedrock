import { EmptyState } from "@/components/empty-state"
import { SubPageHeader } from "@/components/sub-page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getDepartmentOneOnOnes } from "@/lib/api/get-department-oneonones"

export const metadata = { title: "部署の 1on1" }

type Props = {
  params: Promise<{ team: string }>
}

/**
 * 部署ハブの 1on1 タブ。所属メンバーが参加した 1on1 を一覧する。
 * 閲覧には本人が所属する部署への oneonone:read:department が必要。
 */
export default async function DepartmentOneOnOnesPage(props: Props) {
  const params = await props.params

  const sessions = await getDepartmentOneOnOnes(params.team)

  if (sessions instanceof Error) {
    return (
      <div className="flex flex-col gap-6">
        <SubPageHeader title="1on1" />

        <EmptyState title="この部署の 1on1 を閲覧する権限がありません" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SubPageHeader title="1on1" />

      {sessions.length === 0 ? (
        <EmptyState title="この部署の 1on1 はまだありません" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>実施日</TableHead>

                <TableHead>メンバー</TableHead>

                <TableHead>マネージャー</TableHead>

                <TableHead>トピック</TableHead>

                <TableHead>ネクストアクション</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="whitespace-nowrap">
                    {session.held_at.slice(0, 10)}
                  </TableCell>

                  <TableCell className="font-medium whitespace-nowrap">
                    {session.member_name}
                  </TableCell>

                  <TableCell className="whitespace-nowrap">{session.manager_name}</TableCell>

                  <TableCell>{session.topics}</TableCell>

                  <TableCell>{session.next_action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
