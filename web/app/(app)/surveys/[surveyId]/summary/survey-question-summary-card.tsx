import type { SurveyQuestionSummary } from "@/lib/api/types/survey-types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  question: SurveyQuestionSummary
}

// 設問 1 問の集計を表示するカード。
// scale/choice は選択肢別の件数バー、text は自由記述の一覧を出す。
export function SurveyQuestionSummaryCard(props: Props) {
  const distributionEntries = Object.entries(props.question.distribution)

  const maxCount = distributionEntries.reduce(
    (currentMax, entry) => Math.max(currentMax, entry[1]),
    0,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span>{props.question.title}</span>

          <Badge variant="outline">{props.question.type}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {props.question.type === "text" ? (
          <TextAnswerList answers={props.question.answers} />
        ) : (
          <DistributionList entries={distributionEntries} maxCount={maxCount} />
        )}
      </CardContent>
    </Card>
  )
}

type DistributionListProps = {
  entries: ReadonlyArray<[string, number]>
  maxCount: number
}

// 選択肢別の件数を横棒で表示する。
function DistributionList(props: DistributionListProps) {
  if (props.entries.length === 0) {
    return <p className="text-sm text-muted-foreground">回答がありません</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {props.entries.map((entry) => (
        <div key={entry[0]} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-sm">{entry[0]}</span>

          <div className="h-2 flex-1 rounded bg-muted">
            <div
              className="h-2 rounded bg-primary"
              style={{
                width: props.maxCount === 0 ? "0%" : `${(entry[1] / props.maxCount) * 100}%`,
              }}
            />
          </div>

          <span className="w-10 shrink-0 text-right text-sm tabular-nums">{entry[1]}</span>
        </div>
      ))}
    </div>
  )
}

type TextAnswerListProps = {
  answers: ReadonlyArray<string>
}

// 自由記述の回答を一覧表示する。
function TextAnswerList(props: TextAnswerListProps) {
  if (props.answers.length === 0) {
    return <p className="text-sm text-muted-foreground">回答がありません</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {props.answers.map((answer, index) => (
        <li key={`${index}-${answer}`} className="rounded border bg-muted/30 p-2 text-sm">
          {answer}
        </li>
      ))}
    </ul>
  )
}
