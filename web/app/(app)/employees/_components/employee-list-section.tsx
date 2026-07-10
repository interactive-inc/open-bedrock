import { EmployeeTable } from "@/app/(app)/employees/_components/employee-table"
import { FetchError } from "@/components/fetch-error"
import { PAGE_SIZE_OPTIONS, TablePagination } from "@/components/table-pagination"
import { getEmployeeList } from "@/lib/api/get-employee-list"
import type { EmployeeSearchFilter } from "@/lib/api/types/employee-search-filter"

type Props = {
  filter: EmployeeSearchFilter
  offset: number
  limit: number
}

// 絞り込み条件で GET /employees を実行し、結果テーブルを描画する非同期 RSC。
export async function EmployeeListSection(props: Props) {
  const result = await getEmployeeList(props.filter, { limit: props.limit, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="従業員一覧の取得に失敗しました" />
  }

  const filterParams: Record<string, string | undefined> = {
    q: props.filter.q ?? undefined,
    dept: props.filter.dept ?? undefined,
    status: props.filter.status ?? undefined,
    size: String(props.limit),
  }

  return (
    <div className="flex flex-col gap-4">
      <EmployeeTable employees={result.items} />

      <TablePagination
        pathname="/employees"
        total={result.total}
        limit={props.limit}
        offset={props.offset}
        extraParams={filterParams}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  )
}
