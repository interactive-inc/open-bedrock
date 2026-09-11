import Link from "next/link"

type Props = { path: string; offset: number; state: "assigned" | "released"; hasMore: boolean }

/** 利用状態を保って利用記録を20件ずつ送る。 */
export function LicenseUsagePagination(props: Props) {
  return (
    <nav aria-label="利用者のページ送り" className="flex gap-4">
      {props.offset > 0 ? (
        <Link href={`${props.path}?state=${props.state}&offset=${Math.max(0, props.offset - 20)}`}>
          前の20件
        </Link>
      ) : null}
      {props.hasMore && props.offset < 100000 ? (
        <Link
          href={`${props.path}?state=${props.state}&offset=${Math.min(100000, props.offset + 20)}`}
        >
          次の20件
        </Link>
      ) : null}
    </nav>
  )
}
