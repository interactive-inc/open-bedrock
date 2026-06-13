// API がエラー応答を返したことを表す。HTTP status を保持し、呼び出し側（詳細ページ）が
// 401→/login、404→notFound、その他(403/5xx/503)→error boundary へ振り分けられるようにする。
// Error を継承するため、既存の `instanceof Error` による判定はそのまま機能する。
export class ApiResponseError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)

    this.name = "ApiResponseError"
    this.status = status
  }
}
