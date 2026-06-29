import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import Link from "next/link"
import { TableHead } from "@/components/ui/table"

/**
 * テーブルヘッダのソートトグル。pathname + 現在の sort 値 + 列の sort キーから
 * 次の sort 値を計算し ?sort= 付きの Link を描画する。
 * 同じ列を再クリックで昇降反転、別列クリックでその列の desc に切り替え。
 */
type Props = {
  pathname: string
  currentSort: string | null
  ascValue: string
  descValue: string
  label: string
  className?: string
}

export function SortableTableHead(props: Props) {
  const isAsc = props.currentSort === props.ascValue

  const isDesc = props.currentSort === props.descValue

  const isActive = isAsc || isDesc

  const nextSort = isDesc ? props.ascValue : props.descValue

  const Icon = isAsc ? ArrowUp : isDesc ? ArrowDown : ChevronsUpDown

  const href = `${props.pathname}?sort=${nextSort}`

  return (
    <TableHead className={props.className}>
      <Link
        href={href}
        aria-label={`${props.label}で並び替え`}
        className="inline-flex items-center gap-1 hover:text-foreground"
        aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}
      >
        {props.label}
        <Icon className={`size-3 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
      </Link>
    </TableHead>
  )
}
