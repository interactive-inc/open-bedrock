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

/** 原記録の保全確定に失敗した理由。 */
export class RecordPreservationExecutionError extends Error {
  constructor(
    readonly code: "invalid" | "forbidden" | "not_found" | "conflict" | "unavailable",
    options?: ErrorOptions,
  ) {
    super(`record preservation execution ${code}`, options)
    this.name = "RecordPreservationExecutionError"
  }
}

/** 記録保全の人間による判断に失敗した理由。 */
export class RecordPreservationDecisionError extends Error {
  constructor(
    readonly code: "invalid" | "forbidden" | "not_found" | "conflict" | "unavailable",
    options?: ErrorOptions,
  ) {
    super(`record preservation decision ${code}`, options)
    this.name = "RecordPreservationDecisionError"
  }
}
