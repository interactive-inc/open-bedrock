import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
export const help = `karte app delegations`
export default factory.createHandlers(async (c) =>
  c.json(await (await (await createClient())["approval-delegations"].$get()).json()),
)
