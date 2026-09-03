import { SidebarTrigger } from "@/components/ui/sidebar"

/**
 * 全ページ共通の見出しブロック。タイトルと右側アクションを横並びに整える。
 * h1 とアクション領域の縦リズム・余白を統一するために collocation でなく共有コンポーネントにする。
 */
type Props = {
  title: string
  actions?: React.ReactNode
}

export function PageHeader(props: Props) {
  return (
    <div className="flex flex-col gap-2 border-b pb-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-start gap-2">
          <SidebarTrigger variant="secondary" />

          <h1 className="text-base font-semibold">{props.title}</h1>
        </div>

        {props.actions !== undefined ? (
          <div className="flex flex-wrap items-center gap-2">{props.actions}</div>
        ) : null}
      </div>
    </div>
  )
}
