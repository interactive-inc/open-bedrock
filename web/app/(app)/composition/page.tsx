import { PageHeader } from "@/components/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requirePermission } from "@/lib/auth/require-permission"
import catalog from "@/lib/feature/composition-api-catalog.json"

export const metadata = { title: "横断 — ホーム" }

/** 複数contextを組み合わせる公開APIを、URLの接頭辞と切り離して一覧する。 */
export default async function CompositionResourcesPage() {
  await requirePermission("system:admin")
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="ホーム" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>対象APIパス</TableHead>
            <TableHead>使用するコンテキスト</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {catalog.groups.map((group) => (
            <TableRow key={group.routePrefix}>
              <TableCell>
                <ul>
                  {group.routes.map((route) => (
                    <li key={route}>
                      <code>/{route.replaceAll(".", "/").replaceAll("$", ":")}</code>
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell>
                <ul>
                  {group.participants.map((participant) => (
                    <li key={participant}>{participant}</li>
                  ))}
                </ul>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
