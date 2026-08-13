import type { HTTPException } from "hono/http-exception"
import { acceptsSystemProblemDetails } from "@system/domain/http/accepts-system-problem-details"
import { isSystemProblemStatus } from "@system/domain/http/is-system-problem-status"
import { negotiateSystemProblemDetails } from "@system/domain/http/negotiate-system-problem-details"

type Props = Readonly<{ error: HTTPException; accept: string | null }>

/** typed application errorを明示opt-in時だけProblem Details responseへ変換する。 */
export async function toNegotiatedProblemResponse(props: Props): Promise<Response | null> {
  if (!acceptsSystemProblemDetails(props.accept) || !isSystemProblemStatus(props.error.status))
    return null
  if (props.error.res === undefined) return null

  const legacyResponse = props.error.getResponse()
  const body: unknown = await legacyResponse
    .clone()
    .json()
    .catch(() => null)
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null

  const code = Reflect.get(body, "code")
  const detail = Reflect.get(body, "error")
  if (typeof code !== "string" || typeof detail !== "string") return null

  const problem = negotiateSystemProblemDetails({
    accept: props.accept,
    status: props.error.status,
    code,
    detail,
    legacyBody: body,
  })
  if (problem === null) return null
  const headers = new Headers(legacyResponse.headers)
  headers.set("content-type", "application/problem+json")
  const vary = headers.get("vary")
  if (vary === null) headers.set("vary", "Accept")
  else if (!vary.split(",").some((field) => field.trim().toLowerCase() === "accept")) {
    headers.set("vary", `${vary}, Accept`)
  }

  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers,
  })
}
