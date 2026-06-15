/**
 * 全ページ共通の見出しブロック。タイトル・説明・右側アクションを横並びに整える。
 * h1 とアクション領域の縦リズム・余白を統一するために collocation でなく共有コンポーネントにする。
 */
type Props = {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader(props: Props) {
  return (
    <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{props.title}</h1>

        {props.description !== undefined ? (
          <p className="text-sm text-muted-foreground">{props.description}</p>
        ) : null}
      </div>

      {props.actions !== undefined ? (
        <div className="flex items-center gap-2">{props.actions}</div>
      ) : null}
    </div>
  )
}
