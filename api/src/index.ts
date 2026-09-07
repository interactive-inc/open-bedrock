import { app } from "@/api/app"
import { runScheduledOnboarding } from "@/api/scheduled/run-onboarding"
import type { Bindings } from "@/env"

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Bindings): Promise<void> {
    const delivered = await runScheduledOnboarding({ env, clock: () => new Date() })
    if (delivered instanceof Error) throw delivered
  },
}
