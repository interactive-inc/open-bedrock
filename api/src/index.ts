import { runScheduledLeaveNotifications } from "@/api/scheduled/run-leave-notifications"
import { app } from "@/api/app"
import { runScheduledOnboarding } from "@/api/scheduled/run-onboarding"
import type { Bindings } from "@/env"

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Bindings): Promise<void> {
    const deliveries = await Promise.allSettled([
      runScheduledOnboarding({ env, clock: () => new Date() }),
      runScheduledLeaveNotifications({ env, clock: () => new Date() }),
    ])
    for (const delivery of deliveries) {
      if (delivery.status === "rejected") throw delivery.reason
      if (delivery.value instanceof Error) throw delivery.value
    }
  },
}
