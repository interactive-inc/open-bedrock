/** 原記録の保全申請に失敗した理由。内部原因はHTTP応答へ渡さない。 */
export class RecordPreservationSubmissionError extends Error {
  constructor(
    readonly code: "invalid" | "forbidden" | "not_found" | "conflict" | "unavailable",
    options?: ErrorOptions,
  ) {
    super(`record preservation submission ${code}`, options)
    this.name = "RecordPreservationSubmissionError"
  }
}
