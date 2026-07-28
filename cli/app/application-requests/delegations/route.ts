import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
export const help = `bedrock application-requests delegations`
export default factory.createHandlers(async (c) =>
  c.json(await (await (await createClient())["approval-delegations"].$get()).json()),
)
