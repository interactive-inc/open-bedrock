import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { formatDateTime } from "@/lib/format-date-time"

type Decision = {
  id: string
  action: "approve" | "reject" | "return"
  decided_at: string
  comment: string | null
}

/** 永続化した判断IDを使い、表示更新後も同じ記録を識別する。 */
export function ExpenseDecisionHistory({ decisions }: { decisions: ReadonlyArray<Decision> }) {
  return (
    <>
      {" "}
      {decisions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>判断の記録</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-3">
              {decisions.map((decision) => (
                <li key={decision.id}>
                  <p>
                    {decision.action === "approve"
                      ? "承認"
                      : decision.action === "return"
                        ? "差戻し"
                        : "否認"}{" "}
                    — {formatDateTime(decision.decided_at)}
                  </p>
                  <p className="whitespace-pre-wrap">{decision.comment ?? "コメントなし"}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
