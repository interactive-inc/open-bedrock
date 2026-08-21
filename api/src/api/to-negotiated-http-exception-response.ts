import type { HTTPException } from "hono/http-exception"
import { acceptsSystemProblemDetails } from "@system/interface/lib/problem-details/accepts-system-problem-details"
import { isSystemProblemStatus } from "@system/interface/lib/problem-details/is-system-problem-status"
import { toNegotiatedProblemResponse } from "@system/interface/lib/problem-details/to-negotiated-problem-response"
import { readHttpExceptionProblem } from "@/api/read-http-exception-problem"

type Props = Readonly<{ error: HTTPException; accept: string | null }>

/** Hono errorのlegacy responseをSystemの正規化済みerror入力へ適応する。 */
export async function toNegotiatedHttpExceptionResponse(props: Props): Promise<Response | null> {
  if (!acceptsSystemProblemDetails(props.accept) || !isSystemProblemStatus(props.error.status))
    return null
  const problem = await readHttpExceptionProblem(props.error)
  if (problem === null) return null

  return toNegotiatedProblemResponse({
    accept: props.accept,
    status: props.error.status,
    ...problem,
  })
}
