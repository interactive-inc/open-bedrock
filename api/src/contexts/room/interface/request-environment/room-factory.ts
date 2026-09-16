import type { RoomContext } from "@/contexts/room/configuration/room-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type RoomHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & RoomContext["env"]
  Variables: SystemHonoEnv["Variables"] & RoomContext["var"]
}>

export const roomFactory = createFactory<RoomHonoEnv>()
