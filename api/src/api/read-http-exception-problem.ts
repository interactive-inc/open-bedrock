import type { HTTPException } from "hono/http-exception"

export type HttpExceptionProblem = Readonly<{
  code: string
  detail: string
  legacyBody: object
  headers: Headers
}>

/** Hono errorから公開可能なProblem Details入力だけを読み取る。 */
export async function readHttpExceptionProblem(
  error: HTTPException,
): Promise<HttpExceptionProblem | null> {
  if (error.res === undefined) return null
  const response = error.getResponse()
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null)
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null
  const code = Reflect.get(body, "code")
  const detail = Reflect.get(body, "error")

  return typeof code === "string" && typeof detail === "string"
    ? { code, detail, legacyBody: body, headers: response.headers }
    : null
}
