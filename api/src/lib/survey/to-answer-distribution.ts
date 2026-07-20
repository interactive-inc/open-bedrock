export function toAnswerDistribution(
  questionId: string,
  answersList: ReadonlyArray<Record<string, unknown>>,
): Record<string, number> {
  const distribution: Record<string, number> = {}

  for (const answers of answersList) {
    const answer = answers[questionId]

    if (answer === undefined || answer === null || answer === "") {
      continue
    }

    // 集計対象は文字列・数値・真偽の回答のみ。配列やオブジェクトの回答は分布に含めない。
    const key = toDistributionKey(answer)

    if (key === null) {
      continue
    }

    distribution[key] = (distribution[key] ?? 0) + 1
  }

  return distribution
}

/** 回答値を分布キーへ変換する。文字列・数値・真偽以外（配列やオブジェクト）は null。 */
function toDistributionKey(answer: unknown): string | null {
  if (typeof answer === "string") {
    return answer
  }

  if (typeof answer === "number") {
    return answer.toString()
  }

  if (typeof answer === "boolean") {
    return answer ? "true" : "false"
  }

  return null
}
