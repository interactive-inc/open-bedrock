import { ProvisionCompanyBootstrapEmployee } from "@/contexts/company/application/employee/provision-company-bootstrap-employee"
import { CompanyBootstrapEmployeeRepositoryD1 } from "@/contexts/company/infrastructure/employee/company-bootstrap-employee-repository"
import { BootstrapSystemRoot } from "@system/application/iam/bootstrap-system-root"
import { timingSafeStringEqual } from "@/contexts/system/infrastructure/auth/timing-safe-string-equal"
import { PasswordHashService } from "@system/infrastructure/auth/password-hash.service"
import { SystemRootBootstrapRepositoryD1 } from "@system/infrastructure/iam/system-root-bootstrap-repository"
import { factory } from "@/contexts/company/interface/utils/factory"
import { zAppBootstrapResult } from "@/lib/app-schemas"
import { isPlaceholderSecret } from "@/lib/config/is-placeholder-secret"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - 未認証で到達してよい
/**
 * POST /bootstrap — デプロイ直後に 1 度だけ初期 ROOT アカウントを作成する。
 * BOOTSTRAP_TOKEN 未設定なら機能自体を隠す（404）。トークン照合は定数時間で行い、
 * system_bootstrap_state が確定済みなら 409（一回性の本体）。トークンが漏れても再実行できない。
 */
export const POST = factory.createHandlers(
  // zValidator より前に置く。未設定時に不正 body へ 400 を返すと、
  // バリデーションエラーの差で経路の存在が推測できてしまう
  async (c, next) => {
    const expectedToken = c.env.BOOTSTRAP_TOKEN

    if (expectedToken === undefined || expectedToken === "") {
      return c.json({ error: "not_found" }, 404)
    }

    // 例示値のままなら公開リポジトリを読んだ誰でも ROOT を作れる。未設定と同じく隠す。
    if (isPlaceholderSecret(expectedToken)) {
      return c.json({ error: "not_found" }, 404)
    }

    await next()
  },
  zValidator(
    "json",
    z.object({
      token: z.string().min(1),
      email: z.string().email().max(254),
      password: z.string().min(12).max(200),
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

    const tokenMatches = await timingSafeStringEqual(json.token, expectedToken)

    if (tokenMatches === false) {
      return c.json({ error: "unauthorized" }, 401)
    }

    const pepper = c.env.PEPPER_SECRET
    if (pepper === undefined || pepper === "") {
      return c.json({ error: "bootstrap_unavailable" }, 503)
    }

    const now = c.env.NOW === undefined ? new Date() : new Date(c.env.NOW)

    const systemResult = await new BootstrapSystemRoot({
      passwordHasher: {
        hash: (password) => PasswordHashService.hash(password, pepper),
      },
      repository: new SystemRootBootstrapRepositoryD1(c),
    }).execute({
      email: json.email,
      password: json.password,
      now,
    })
    if (systemResult instanceof Error) {
      return c.json({ error: "bootstrap_failed" }, 500)
    }
    if (systemResult.kind === "invalid_input") {
      return c.json({ error: "invalid_bootstrap_input" }, 400)
    }
    if (
      systemResult.kind === "already_initialized" &&
      systemResult.state === "account_exists_without_bootstrap_state"
    ) {
      return c.json({ error: "already_initialized" }, 409)
    }
    if (
      systemResult.accountId === null ||
      systemResult.identityId === null ||
      systemResult.rootBindingId === null ||
      systemResult.email === null
    ) {
      return c.json({ error: "bootstrap_incomplete" }, 500)
    }

    const companyResult = await new ProvisionCompanyBootstrapEmployee({
      repository: new CompanyBootstrapEmployeeRepositoryD1(c),
    }).execute({
      accountId: systemResult.accountId,
      employeeCode: json.code ?? "E001",
      name: json.name,
      now: c.var.now(),
    })
    if (companyResult instanceof Error) {
      return c.json({ error: "bootstrap_failed" }, 500)
    }
    if (companyResult.kind === "invalid_input") {
      return c.json({ error: "invalid_bootstrap_input" }, 400)
    }
    if (companyResult.state === "company_exists_without_account_link") {
      return c.json({ error: "company_bootstrap_incomplete" }, 500)
    }
    if (
      systemResult.kind === "already_initialized" &&
      companyResult.kind === "already_initialized"
    ) {
      return c.json({ error: "already_initialized" }, 409)
    }

    const responseBody = zAppBootstrapResult.parse({
      account_id: systemResult.accountId,
      employee_id: companyResult.employeeId,
      email: systemResult.email,
    })

    return c.json(responseBody, 201)
  },
)
