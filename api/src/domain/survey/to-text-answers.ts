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

  return textAnswers
}
