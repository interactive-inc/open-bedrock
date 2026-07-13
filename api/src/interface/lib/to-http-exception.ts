import { HTTPException } from "hono/http-exception"
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

// application 層が返した ApplicationError を HTTP セマンティクスへ翻訳する。
// クラスで HTTP ステータスを決め、応答には安全な message と code だけを載せる。
// UnexpectedError など未知のクラスは 500 に倒し、内部の cause は応答に出さない。

/**
 * ApplicationError を Hono の HTTPException に変換する。
 * 応答ボディは onError が message を、ここで付与する code を返す
 */
export function toHttpException(error: ApplicationError): HTTPException {
  const status = toStatus(error)

  return new HTTPException(status, {
    res: new Response(JSON.stringify({ error: error.message, code: error.code }), {
      status: status,
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
