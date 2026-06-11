import { Suspense } from "react"
import { EmployeeListSection } from "@/app/(app)/employees/_components/employee-list-section"
import { EmployeeSearchForm } from "@/app/(app)/employees/_components/employee-search-form"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  EmployeeSearchFilter,
  EmployeeStatusFilter,
} from "@/lib/api/types/employee-search-filter"

export const metadata = { title: "従業員" }

type Props = {
  searchParams: Promise<{ [key: string]: string | Array<string> | undefined }>
}

// 従業員一覧画面。searchParams から絞り込み条件を組み立て、
// フォーム + 非同期テーブルを Suspense 境界で描画する RSC。
export default async function EmployeesPage(props: Props) {
  const params = await props.searchParams

  const filter = toFilter(params)

  const suspenseKey = `${filter.q ?? ""}:${filter.dept ?? ""}:${filter.status ?? ""}`

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">従業員</h1>

      <EmployeeSearchForm filter={filter} />

      <Suspense key={suspenseKey} fallback={<EmployeeTableSkeleton />}>
        <EmployeeListSection filter={filter} />
      </Suspense>
    </div>
  )
}

// searchParams の生の値を EmployeeSearchFilter に正規化する。
function toFilter(params: {
  [key: string]: string | Array<string> | undefined
}): EmployeeSearchFilter {
  return {
    q: toSingleValue(params.q),
    dept: toSingleValue(params.dept),
    status: toStatus(params.status),
  }
}

// 配列・未定義・空文字を null に潰した単一文字列を返す。
function toSingleValue(value: string | Array<string> | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  if (value === "") {
    return null
  }

  return value
}

// status を許可された enum のみに絞り込む。範囲外は null。
function toStatus(value: string | Array<string> | undefined): EmployeeStatusFilter | null {
  if (value === "active") {
    return "active"
  }

  if (value === "leave") {
    return "leave"
  }

  if (value === "retired") {
    return "retired"
  }

  return null
}

function EmployeeTableSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
