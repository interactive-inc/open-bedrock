import { EmployeeTable } from "@/app/(app)/employees/_components/employee-table"
import { FetchError } from "@/components/fetch-error"
import { getEmployeeList } from "@/lib/api/get-employee-list"
import type { EmployeeSearchFilter } from "@/lib/api/types/employee-search-filter"

type Props = {
  filter: EmployeeSearchFilter
}

// 絞り込み条件で GET /employees を実行し、結果テーブルを描画する非同期 RSC。
export async function EmployeeListSection(props: Props) {
  const employees = await getEmployeeList(props.filter)

  if (employees instanceof Error) {
    return <FetchError message="従業員一覧の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{employees.length} 件</p>

      <EmployeeTable employees={employees} />
    </div>
  )
}
