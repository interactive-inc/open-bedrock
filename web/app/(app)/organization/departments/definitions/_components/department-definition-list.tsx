import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DepartmentDefinitionResponse } from "@/lib/api/types/department-definition-types"

type Props = {
  departmentDefinitions: ReadonlyArray<DepartmentDefinitionResponse>
}

/** 部署マスタ一覧テーブル。ID と名称のみのマスタをそのまま表示する。 */
export function DepartmentDefinitionList(props: Props) {
  if (props.departmentDefinitions.length === 0) {
    return (
      <EmptyState
        title="部署マスタがありません"
        description="下のフォームから部署マスタを登録しましょう。"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="部署マスタ一覧">
        <TableHeader>
          <TableRow>
            <TableHead className="w-24 text-right">ID</TableHead>
            <TableHead>名称</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.departmentDefinitions.map((department) => (
            <TableRow key={department.id}>
              <TableCell className="text-right font-medium">{department.id}</TableCell>

              <TableCell>{department.name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
