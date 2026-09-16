import type { OnboardingContext } from "@/contexts/onboarding/configuration/onboarding-context"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { createFactory } from "hono/factory"

export type OnboardingHonoEnv = Readonly<{
  Bindings: SystemHonoEnv["Bindings"] & OnboardingContext["env"]
  Variables: SystemHonoEnv["Variables"] & OnboardingContext["var"]
}>

export const onboardingFactory = createFactory<OnboardingHonoEnv>()
