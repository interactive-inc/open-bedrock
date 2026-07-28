/**
 * ワークフロー定義の楽観ロック衝突。期待リビジョンと保存済みリビジョンが一致しないときに返す
 */
export class WorkflowRevisionConflictError extends Error {
  constructor() {
    super("workflow revision conflict")
    this.name = "WorkflowRevisionConflictError"
    Object.freeze(this)
  }
}
