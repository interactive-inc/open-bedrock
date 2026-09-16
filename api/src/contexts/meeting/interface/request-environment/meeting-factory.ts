import type { MeetingContext } from "@/contexts/meeting/configuration/meeting-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type MeetingHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & MeetingContext["env"]
  Variables: SystemHonoEnv["Variables"] & MeetingContext["var"]
}>

export const meetingFactory = createFactory<MeetingHonoEnv>()
