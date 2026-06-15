import type { LucideIcon } from "lucide-react"

/**
 * 一覧が空の時に表示する共通ブロック。アイコン + 短文 + 任意のアクションで一貫した見た目にする。
 */
type Props = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState(props: Props) {
  const Icon = props.icon

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-12 text-center">
      {Icon !== undefined ? (
        <div className="rounded-full bg-muted p-3">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{props.title}</p>

        {props.description !== undefined ? (
          <p className="text-sm text-muted-foreground">{props.description}</p>
        ) : null}
      </div>

      {props.action !== undefined ? <div>{props.action}</div> : null}
    </div>
  )
}
