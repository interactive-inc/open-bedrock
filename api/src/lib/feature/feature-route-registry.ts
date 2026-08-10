/**
 * 機能キーと API ルート接頭辞の対応表。機能キーは web の feature-registry の slug と揃える。
 * 区分の正本は .docs/feature-tiers.md。company-optional は既定で無効、company-standard は既定で有効。
 * ここに無いルート（システム層・company-core）はゲート対象外で常に有効。
 */
export const optionalFeatureRoutePrefixes: Readonly<Record<string, ReadonlyArray<string>>> = {
  "one-on-ones": ["/one-on-ones"],
  thanks: [
    "/thanks-messages",
    "/thanks-rewards",
    "/thanks-redemptions",
    "/thanks-point-balances",
    "/thanks-point-budgets",
  ],
  goals: ["/performance-goals"],
  "performance-reviews": ["/review-cycles", "/review-forms"],
  skills: ["/skill-definitions", "/employee-skills"],
  career: ["/career-postings", "/career-applications", "/career-sheets"],
  surveys: ["/surveys"],
  knowledge: ["/knowledge-articles"],
  training: ["/training-courses", "/training-enrollments"],
  "management-dashboard": ["/dashboard/management"],
}

export const standardFeatureRoutePrefixes: Readonly<Record<string, ReadonlyArray<string>>> = {
  attendance: ["/attendance-records"],
  leave: ["/leave-requests", "/leave-balances"],
  "family-care-leave": ["/family-care-leaves"],
  shifts: ["/shift-assignments", "/shift-patterns", "/shift-swap-requests"],
  "company-calendar": ["/company-calendar-days"],
  expenses: ["/expenses"],
  "business-trips": ["/business-trips"],
  "life-events": ["/life-events"],
  ringi: ["/ringi-requests"],
  "antisocial-checks": ["/antisocial-checks"],
  recruitment: ["/job-openings", "/recruitment-candidates"],
  "headcount-plans": ["/headcount-plans"],
  "health-checkups": ["/health-checkups"],
  "work-accidents": ["/work-accidents"],
  certifications: ["/certification-definitions", "/employee-certifications"],
  commendations: ["/commendations"],
  assets: ["/assets", "/stocktakes"],
  rooms: ["/rooms"],
  rentals: ["/rental-reservations"],
  meetings: ["/meetings", "/meeting-minutes-records"],
  partners: ["/partners", "/partner-contracts"],
  budgets: ["/department-budgets"],
  "software-licenses": ["/software-licenses"],
  "it-incidents": ["/it-incidents"],
}
