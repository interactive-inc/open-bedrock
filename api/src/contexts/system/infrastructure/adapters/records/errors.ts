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

/** 記録保全の判断対象の参照に失敗した理由。 */
export class RecordPreservationReviewError extends Error {
  constructor(
    readonly code: "invalid" | "forbidden" | "not_found" | "conflict" | "unavailable",
    options?: ErrorOptions,
  ) {
    super(`record preservation review ${code}`, options)
    this.name = "RecordPreservationReviewError"
  }
}

/** 記録保全の取下げに失敗した理由。 */
export class RecordPreservationWithdrawalError extends Error {
  constructor(
    readonly code: "invalid" | "forbidden" | "not_found" | "conflict" | "unavailable",
    options?: ErrorOptions,
  ) {
    super(`record preservation withdrawal ${code}`, options)
    this.name = "RecordPreservationWithdrawalError"
  }
}
