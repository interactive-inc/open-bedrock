// certificate-request ドメインの手書き型。api 側 zod スキーマと疎結合に保つため
// z.infer を import せず、レスポンス/リクエストの shape をここで独立に定義する。

// POST /certificate-requests のリクエストボディ。submit_to/needed_by/note は任意（記録のみ）。
export type CertificateRequestCreateRequest = {
  certificate_type: string
  submit_to: string | null
  needed_by: string | null
  note: string | null
}

// PUT /certificate-requests/:id のリクエストボディ。
export type CertificateRequestUpdateRequest = {
  certificate_type: string
  submit_to: string | null
  needed_by: string | null
  note: string | null
}

// GET /certificate-requests/me と /certificate-requests/:id のレスポンス要素。api は snake_case で返す。
export type CertificateRequestResponse = {
  id: string
  requester_id: number
  certificate_type: string
  submit_to: string | null
  needed_by: string | null
  note: string | null
  status: string
  created_at: string
}
