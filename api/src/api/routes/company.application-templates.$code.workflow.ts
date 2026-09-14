import {
  GET as canonicalGET,
  PUT as canonicalPUT,
} from "@/api/routes/application-templates.$code.workflow"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"

/** 旧URLの互換入口。認可・検証・処理は中立URLと同じhandlerを使用する。 */
// @authorization service - 同じ認証済みhandlerの認可を再利用する
export const GET = factory.createHandlers(verifyBearer, ...canonicalGET)

// @authorization service - 同じ認証済みhandlerの認可を再利用する
export const PUT = factory.createHandlers(verifyBearer, ...canonicalPUT)
