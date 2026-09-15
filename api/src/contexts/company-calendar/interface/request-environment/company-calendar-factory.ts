import type { CompanyCalendarDayContext } from "@/contexts/company-calendar/configuration/company-calendar-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type CompanyCalendarDayHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & CompanyCalendarDayContext["env"]
  Variables: SystemHonoEnv["Variables"] & CompanyCalendarDayContext["var"]
}>

export const companyCalendarDayFactory = createFactory<CompanyCalendarDayHonoEnv>()
