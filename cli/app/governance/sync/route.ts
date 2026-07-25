import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { readGovernanceMarkdownSources } from "@/lib/governance/read-governance-markdown"
import { api } from "@/lib/http/client"

export const help = `bedrock governance sync [--path <file-or-directory>]

既定値は .docs/governance。README.md とシンボリックリンクは同期対象外です。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({ help: z.string().optional(), path: z.string().max(500).optional() }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    const documents = await readGovernanceMarkdownSources(input.path ?? ".docs/governance")
    return c.json(await api("/governance/documents/sync", { method: "POST", json: { documents } }))
  },
)
