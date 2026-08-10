import { HTTPException } from "hono/http-exception"
import { createSystemProblemDetails } from "@/domain/system/http/create-system-problem-details"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnavailableError,
  UnprocessableError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

/**
 * application 層が返した ApplicationError を Hono の HTTPException（HTTP セマンティクス）へ翻訳する。
 * クラスで HTTP ステータスを決め、応答ボディは onError が message を、ここで付与する code を返す。
 * UnexpectedError など未知のクラスは 500 に倒し、内部の cause は応答に出さない
 */
export function toHttpException(error: ApplicationError): HTTPException {
  const status = toStatus(error)
  const problem = createSystemProblemDetails({
    status: status,
    code: error.code,
    detail: error.message,
  })

  return new HTTPException(problem.status, {
    res: new Response(JSON.stringify({ error: problem.detail, code: problem.code }), {
      status: problem.status,
      headers: { "content-type": "application/json" },
    }),
  })
}

/**
 * ApplicationError のクラスから HTTP ステータスを決める
 */
function toStatus(error: ApplicationError): 400 | 403 | 404 | 409 | 413 | 422 | 500 | 503 {
  if (error instanceof NotFoundError) {
    return 404
  }

  if (error instanceof ForbiddenError) {
    return 403
  }

  if (error instanceof ConflictError) {
    return 409
  }

  if (error instanceof ValidationError) {
    return 400
  }

  if (error instanceof UnprocessableError) {
    return 422
  }

  if (error instanceof PayloadTooLargeError) {
    return 413
  }

  if (error instanceof UnavailableError) {
    return 503
  }

  return 500
}
