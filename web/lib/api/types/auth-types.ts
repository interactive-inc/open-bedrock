// api/src/auth の *-response-schema.ts と同形の手書き type。
// api と疎結合にするため import しない。
export type LoginRequest = {
  email: string
  password: string
}

export type LoginResponse = {
  access_token: string
  refresh_token: string | null
}

export type RefreshResponse = {
  access_token: string
  refresh_token: string | null
}

export type MeResponse = {
  id: number
  code: string
  name: string
  email: string
  role: string
  dept_name: string | null
  position: string | null
  permissions: ReadonlyArray<string>
  role_keys: ReadonlyArray<string>
}
