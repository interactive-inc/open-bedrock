import { notFound } from "next/navigation"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { getDecisionDetail } from "@/lib/api/get-decision-detail"
import { handleDetailError } from "@/lib/api/handle-detail-error"

export const metadata = { title: "意思決定記録の詳細" }

type Props = {
  params: Promise<{ decision: string }>
}

/** id 文字列を正の整数へ変換する。無効なら null。 */
function toDecisionId(rawId: string): number | null {
  const parsed = Number(rawId)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

/** /decisions/:id 意思決定記録の詳細。ADR らしく背景・決定・帰結をセクションで分けて表示する。 */
export default async function DecisionDetailPage(props: Props) {
  const params = await props.params

  const decisionId = toDecisionId(params.decision)

  if (decisionId === null) {
    notFound()
  }

  const decision = await getDecisionDetail(decisionId)

  if (decision instanceof Error) {
    handleDetailError(decision)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={decision.title}
        actions={<BackButton href="/meeting/decisions" label="一覧に戻る" />}
      />

      <div className="flex flex-wrap items-center gap-2">
        {decision.status === "superseded" ? (
          <Badge variant="outline">置き換え済み</Badge>
        ) : (
          <Badge variant="secondary">有効</Badge>
        )}

        {decision.superseded_by_id === null ? null : (
          <span className="text-sm text-muted-foreground">
            後続の記録 #{decision.superseded_by_id} に置き換え
          </span>
        )}
      </div>

      <Section title="背景（Context）" body={decision.context} />

      <Section title="決定内容（Decision）" body={decision.decision} />

      {decision.consequences === null ? null : (
        <Section title="帰結（Consequences）" body={decision.consequences} />
      )}
    </div>
  )
}

type SectionProps = {
  title: string
  body: string
}

/** ADR の 1 セクション（見出し + 本文原文）を表示する純粋なプレゼンテーション。 */
function Section(props: SectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-medium">{props.title}</h2>

      <Card className="p-0 gap-0">
        <p className="whitespace-pre-wrap p-4 text-sm leading-relaxed">{props.body}</p>
      </Card>
    </div>
  )
}
