const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
} as const

export class OidcResponse {
  static json(value: unknown, status = 200): Response {
    return Response.json(value, { status, headers: NO_STORE_HEADERS })
  }
}
