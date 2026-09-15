import type { AnnouncementContext } from "@/contexts/announcement/configuration/announcement-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type AnnouncementHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & AnnouncementContext["env"]
  Variables: SystemHonoEnv["Variables"] & AnnouncementContext["var"]
}>

export const announcementFactory = createFactory<AnnouncementHonoEnv>()
