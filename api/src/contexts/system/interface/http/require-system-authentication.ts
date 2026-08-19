import { systemFactory } from "@system/interface/http/system-factory"
import { HTTPException } from "hono/http-exception"

/** 製品compositionが検証済みSystem主体を注入しなければ、認証routeを必ず閉じる。 */
export const requireSystemAuthentication = systemFactory.createMiddleware(async (context, next) => {
  if (
    typeof context.var.userId !== "string" ||
    context.var.userId.length === 0 ||
    !Number.isSafeInteger(context.var.accountTokenVersion) ||
    context.var.accountTokenVersion < 0 ||
    typeof context.var.role !== "string" ||
    context.var.role.length === 0 ||
    typeof context.var.permissions?.has !== "function"
  ) {
    throw new HTTPException(401, { message: "authentication required" })
  }

  await next()
})
