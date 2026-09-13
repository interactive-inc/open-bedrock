import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

type AttendanceHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] &
    Readonly<{
      COMPANY_TIME_ZONE?: string
      NOW?: string
      RECORD_SOURCE_NAMESPACE?: string
    }>
  Variables: SystemHonoEnv["Variables"]
}>

export const attendanceFactory = createFactory<AttendanceHonoEnv>()
