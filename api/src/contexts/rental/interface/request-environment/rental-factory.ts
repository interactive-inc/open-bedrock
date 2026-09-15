import type { RentalReservationContext } from "@/contexts/rental/configuration/rental-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type RentalReservationHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & RentalReservationContext["env"]
  Variables: SystemHonoEnv["Variables"] & RentalReservationContext["var"]
}>

export const rentalReservationFactory = createFactory<RentalReservationHonoEnv>()
