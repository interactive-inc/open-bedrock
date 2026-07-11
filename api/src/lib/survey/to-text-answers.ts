/**
 * 設問1件の自由記述回答を集める。匿名サマリー用に回答者順を捨て、
 * 回答テキストをロケール非依存の UTF-16 比較でソートして返す。
 * 設問ごとに独立してソートするため、設問横断で answers[i] を突合しても
 * 同一回答者の自由記述を再構成できない。
 */
export function toTextAnswers(
  questionId: string,
  answersList: ReadonlyArray<Record<string, unknown>>,
): ReadonlyArray<string> {
  const textAnswers: Array<string> = []

  for (const answers of answersList) {
    const answer = answers[questionId]

    if (typeof answer === "string" && answer !== "") {
      textAnswers.push(answer)
    }
  }

  return textAnswers.sort()
}
