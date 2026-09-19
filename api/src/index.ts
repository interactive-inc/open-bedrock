import { SCHEDULED_JOBS } from "@/api/scheduled/jobs"
import type { Bindings } from "@/env"

export default {
  async fetch(request: Request, env: Bindings, context: ExecutionContext): Promise<Response> {
    const { app } = await import("@/api/app")
    return app.fetch(request, env, context)
  },
  async scheduled(_controller: ScheduledController, env: Bindings): Promise<void> {
    const deliveries = await Promise.allSettled(
      SCHEDULED_JOBS.map((job) => job({ env, clock: () => new Date() })),
    )
    for (const delivery of deliveries) {
      if (delivery.status === "rejected") throw delivery.reason
      if (delivery.value instanceof Error) throw delivery.value
    }
  },
}
