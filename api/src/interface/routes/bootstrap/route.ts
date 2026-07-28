import { BootstrapInitialAccount } from "@/application/iam/bootstrap-initial-account"
import { factory } from "@/interface/utils/factory"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppBootstrapResult } from "@/lib/app-schemas"
import { timingSafeEqual } from "@/lib/auth/timing-safe-equal"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - 未認証で到達してよい
/**
 * POST /bootstrap — デプロイ直後に 1 度だけ初期 ROOT アカウントを作成する。
 * BOOTSTRAP_TOKEN 未設定なら機能自体を隠す（404）。トークン照合は定数時間で行い、
 * accounts が既に存在すれば 409（一回性の本体）。トークンが漏れても初期化済みなら永久に無効。
 */
export const POST = factory.createHandlers(
  // zValidator より前に置く。未設定時に不正 body へ 400 を返すと、
  // バリデーションエラーの差で経路の存在が推測できてしまう
  async (c, next) => {
    const expectedToken = c.env.BOOTSTRAP_TOKEN

    if (expectedToken === undefined || expectedToken === "") {
      return c.json({ error: "not_found" }, 404)
    }

    await next()
  },
  zValidator(
    "json",
    z.object({
      token: z.string().min(1),
      email: z.string().email().max(254),
      password: z.string().min(1).max(200),
      name: z.string().min(1).max(200),
      code: z.string().min(1).max(64).optional(),
    }),
  ),
  async (c) => {
    const expectedToken = c.env.BOOTSTRAP_TOKEN

    if (expectedToken === undefined || expectedToken === "") {
      return c.json({ error: "not_found" }, 404)
    }

    const json = c.req.valid("json")

    const tokenMatches = await timingSafeEqual(json.token, expectedToken)

    if (tokenMatches === false) {
      return c.json({ error: "unauthorized" }, 401)
    }

    const now = c.env.NOW === undefined ? new Date() : new Date(c.env.NOW)

    const result = await new BootstrapInitialAccount(c).run({
      email: json.email,
      password: json.password,
      name: json.name,
      code: json.code ?? "E001",
      now,
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    if ("reason" in result) {
      return c.json({ error: "already_initialized" }, 409)
    }

    const responseBody = zAppBootstrapResult.parse({
      account_id: result.accountId,
      employee_id: result.employeeId,
      email: result.email,
    })

    return c.json(responseBody, 201)
  },
)
