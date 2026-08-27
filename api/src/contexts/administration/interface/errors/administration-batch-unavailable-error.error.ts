import { AdministrationHTTPException } from "@/contexts/administration/interface/errors"

export class AdministrationBatchUnavailableError extends AdministrationHTTPException {
  constructor(cause: unknown) {
    super({
      status: 500,
      code: "batch_read_failed",
      message: "バッチ実行状況を取得できませんでした。",
      cause,
    })
    this.name = "AdministrationBatchUnavailableError"
  }
}
