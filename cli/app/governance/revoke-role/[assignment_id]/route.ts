import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { api } from "@/lib/http/client"

export const help = `bedrock governance revoke-role <assignment-id>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({ help: z.string().optional(), assignment_id: z.string().optional() }),
  ),
  zValidator("param", z.object({ assignment_id: z.string().optional() })),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    const assignmentId = c.req.valid("param").assignment_id ?? input.assignment_id
    if (!assignmentId || !/^[1-9]\d*$/.test(assignmentId)) {
      throw new UsageError("assignment-id は正の整数で指定してください")
    }
    await api(`/governance/org-roles/assignments/${assignmentId}`, { method: "DELETE" })
    return c.json({ revoked: true, assignment_id: Number(assignmentId) })
  },
)
