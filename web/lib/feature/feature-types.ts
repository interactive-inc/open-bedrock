import type { LucideIcon } from "lucide-react"

export type FeatureTier = "system" | "company" | "app-default" | "app-opt-in"

export type FeatureStatus = "available" | "development" | "retirement-candidate"

export type FeatureGroup =
  | "overview"
  | "time"
  | "requests"
  | "people"
  | "growth"
  | "communication"
  | "workplace"
  | "governance"
  | "system"
  // Company 空間の章立て。`.docs/capability-map.md` の Company 章に合わせる。
  | "company-legal-entity"
  | "company-people"
  | "company-organization"
  | "company-responsibility"
  | "company-system-link"
  | "company-employment-fact"

export type FeatureSpace = "system" | "company" | "apps"

export type FeatureNavigationVisibility =
  | { kind: "everyone" }
  | { kind: "permission"; permission: string }
  | { kind: "any-permission"; permissions: ReadonlyArray<string> }
  | { kind: "all-permissions"; permissions: ReadonlyArray<string> }

export type FeatureRoute = {
  label: string
  href: string
  visibility: FeatureNavigationVisibility
}

export type FeatureDefinition = {
  slug: string
  tier: FeatureTier
  status: FeatureStatus
  group: FeatureGroup
  icon: LucideIcon
  prefetch: boolean | null
  routes: ReadonlyArray<FeatureRoute>
}

export type FeatureNavigationItem = {
  slug: string
  tier: FeatureTier
  status: FeatureStatus
  group: FeatureGroup
  icon: LucideIcon
  prefetch: boolean | null
  label: string
  href: string
  visibility: FeatureNavigationVisibility
}

export type FeatureNavigationSection = {
  heading: string
  items: ReadonlyArray<FeatureNavigationItem>
}
