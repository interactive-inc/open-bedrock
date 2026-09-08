import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import { zValidator } from "@hono/zod-validator"
import {
  SoftwareLicenseForbiddenError,
  SoftwareLicenseUnavailableError,
} from "@/contexts/software-license/interface/errors"
import { z } from "zod"

// @authorization permission - 台帳と同じ全社閲覧権限で変更前後と記録者を参照する
export const GET = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  zValidator("param", z.object({ id: licenseIdSchema })),
  zValidator("query", z.object({ offset: z.coerce.number().int().min(0).max(100000).default(0) })),
  async (c) => {
    if (!c.var.permissions.has("license:read:all") && !c.var.permissions.has("system:admin"))
      throw new SoftwareLicenseForbiddenError()
    const history =
      await c.env.DB.prepare(`SELECT id,license_id,actor_account_id,recorded_at,before_json,after_json
      FROM software_license_changes WHERE license_id=?1 ORDER BY recorded_at DESC,id LIMIT 51 OFFSET ?2`)
        .bind(c.req.valid("param").id, c.req.valid("query").offset)
        .all()
    if (!history.success) throw new SoftwareLicenseUnavailableError()
    const changes = z
      .array(
        z.object({
          id: z.string(),
          license_id: z.number(),
          actor_account_id: z.string(),
          recorded_at: z.number(),
          before_json: z.string().nullable(),
          after_json: z.string(),
        }),
      )
      .parse(history.results)
    return c.json({ data: changes.slice(0, 50), has_more: changes.length > 50 }, 200)
  },
)
