import path from "node:path"
import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // bun workspaces のモノレポ: next は root node_modules に巻き上げられるため
  // Turbopack root はリポジトリルート。outputFileTracingRoot は同値制約で揃える
  turbopack: {
    root: path.join(import.meta.dirname, ".."),
  },
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),

  // portless のプロキシ経由（bedrock.localhost）で dev リソースと HMR を許可する
  allowedDevOrigins: ["bedrock.localhost"],

  // Codex のローカル in-app browser は sandboxed frame から Server Action を送るため
  // Origin が `null` になる。production では許可せず、通常の same-origin 検査を維持する。
  experimental: {
    serverActions:
      process.env.NODE_ENV === "development" ? { allowedOrigins: ["null"] } : undefined,
  },

  /**
   * URL を RESTful に再編した第1弾のリダイレクト（ブックマーク・既存導線の互換維持）。
   * 各ファミリーで具体的なサブパスを先に、base を後に置く（配列は先頭一致）。
   * 動的セグメントは :param で受け、並べ替え系は順序を入れ替えて転送する。
   */
  async redirects() {
    // 空間再編(my / teams / organization / system)による移動。
    // 旧 URL からの転送はここで一括生成する。第一世代 URL は下の個別 redirects を
    // 経由して二段で最新へ到達する(連鎖許容)。
    const systemResources = [
      "accounts",
      "audit-events",
      "batches",
      "it-incidents",
      "licenses",
      "roles",
    ]

    const organizationResources = [
      "announcements",
      "application-templates",
      "applications",
      "assets",
      "attendances",
      "budgets",
      "business-trips",
      "calendars",
      "certificate-requests",
      "certifications",
      "commendations",
      "dashboards",
      "decisions",
      "documents",
      "employees",
      "expenses",
      "family-care-leaves",
      "goals",
      "governance",
      "grades",
      "headcount-plans",
      "health-checkups",
      "job-postings",
      "knowledge-articles",
      "leaves",
      "life-events",
      "meetings",
      "onboarding-assignments",
      "onboarding-templates",
      "partners",
      "positions",
      "recruitments",
      "regulations",
      "rentals",
      "resignations",
      "review-cycles",
      "reviews",
      "rewards",
      "ringis",
      "rooms",
      "shift-assignments",
      "shift-patterns",
      "shift-swaps",
      "skills",
      "stocktakes",
      "surveys",
      "thanks",
      "thanks-redemptions",
      "trainings",
      "work-accidents",
      "workflow-repairs",
    ]

    const spaceMoves = [
      { from: "me", to: "my" },
      { from: "oneonones", to: "my/oneonones" },
      { from: "settings", to: "my/settings" },
      ...systemResources.map((resource) => ({ from: resource, to: `system/${resource}` })),
      ...organizationResources.map((resource) => ({
        from: resource,
        to: `organization/${resource}`,
      })),
    ]

    const spaceRedirects = spaceMoves.flatMap((move) => [
      { source: `/${move.from}`, destination: `/${move.to}`, permanent: false },
      { source: `/${move.from}/:path*`, destination: `/${move.to}/:path*`, permanent: false },
    ])

    return [
      // --- admin 系 ---
      {
        source: "/admin/audit-events/:path*",
        destination: "/audit-events/:path*",
        permanent: false,
      },
      // --- 単純リネーム ---
      { source: "/batch", destination: "/batches", permanent: false },
      { source: "/calendar", destination: "/calendars", permanent: false },
      { source: "/dashboard/management", destination: "/dashboards/management", permanent: false },
      { source: "/knowledge/:path*", destination: "/knowledge-articles/:path*", permanent: false },
      { source: "/oneonone/:path*", destination: "/oneonones/:path*", permanent: false },
      { source: "/oneonone", destination: "/oneonones", permanent: false },
      { source: "/recruitment/:path*", destination: "/recruitments/:path*", permanent: false },
      { source: "/training/me", destination: "/my/trainings", permanent: false },
      { source: "/training/:path*", destination: "/trainings/:path*", permanent: false },
      { source: "/training", destination: "/trainings", permanent: false },
      // --- attendance ---
      { source: "/attendance/all", destination: "/attendances", permanent: false },
      { source: "/attendance/overtime", destination: "/attendances/overtime", permanent: false },
      { source: "/attendance", destination: "/my/attendances", permanent: false },
      // --- leave ---
      { source: "/leave/admin", destination: "/leaves", permanent: false },
      { source: "/leave/inbox", destination: "/inbox/leaves", permanent: false },
      { source: "/leave/new", destination: "/my/leaves/new", permanent: false },
      { source: "/leave", destination: "/my/leaves", permanent: false },
      // --- expense（詳細は複数形へ改名） ---
      { source: "/expense/admin", destination: "/expenses", permanent: false },
      { source: "/expense/inbox", destination: "/inbox/expenses", permanent: false },
      { source: "/expense/new", destination: "/my/expenses/new", permanent: false },
      { source: "/expense/:id", destination: "/expenses/:id", permanent: false },
      { source: "/expense", destination: "/my/expenses", permanent: false },
      // --- applications（詳細 URL は不変なので転送不要） ---
      { source: "/applications/admin", destination: "/applications", permanent: false },
      { source: "/applications/inbox", destination: "/inbox/applications", permanent: false },
      {
        source: "/applications/templates/new",
        destination: "/application-templates/new",
        permanent: false,
      },
      {
        source: "/applications/templates/:path*",
        destination: "/application-templates/:path*",
        permanent: false,
      },
      {
        source: "/applications/delegations",
        destination: "/teams/approval-delegations",
        permanent: false,
      },
      {
        source: "/applications/workflow-repairs",
        destination: "/workflow-repairs",
        permanent: false,
      },
      { source: "/applications", destination: "/my/applications", permanent: false },
      // --- ringi ---
      { source: "/ringi/admin", destination: "/ringis", permanent: false },
      { source: "/ringi/inbox", destination: "/inbox/ringis", permanent: false },
      { source: "/ringi/new", destination: "/my/ringis/new", permanent: false },
      { source: "/ringi", destination: "/my/ringis", permanent: false },
      // --- business-trips 系6（admin→base, self→/me） ---
      { source: "/business-trips/admin", destination: "/business-trips", permanent: false },
      { source: "/business-trips/new", destination: "/my/business-trips/new", permanent: false },
      { source: "/business-trips", destination: "/my/business-trips", permanent: false },
      {
        source: "/certificate-requests/admin",
        destination: "/certificate-requests",
        permanent: false,
      },
      {
        source: "/certificate-requests/new",
        destination: "/my/certificate-requests/new",
        permanent: false,
      },
      {
        source: "/certificate-requests",
        destination: "/my/certificate-requests",
        permanent: false,
      },
      { source: "/life-events/admin", destination: "/life-events", permanent: false },
      { source: "/life-events/new", destination: "/my/life-events/new", permanent: false },
      { source: "/life-events", destination: "/my/life-events", permanent: false },
      { source: "/family-care-leaves/admin", destination: "/family-care-leaves", permanent: false },
      {
        source: "/family-care-leaves/new",
        destination: "/my/family-care-leaves/new",
        permanent: false,
      },
      { source: "/family-care-leaves", destination: "/my/family-care-leaves", permanent: false },
      { source: "/resignations/admin", destination: "/resignations", permanent: false },
      { source: "/resignations/new", destination: "/my/resignations/new", permanent: false },
      { source: "/resignations", destination: "/my/resignations", permanent: false },
      { source: "/rentals/admin", destination: "/rentals", permanent: false },
      { source: "/rentals/new", destination: "/my/rentals/new", permanent: false },
      { source: "/rentals", destination: "/my/rentals", permanent: false },
      // --- antisocial-checks ---
      {
        source: "/antisocial-checks/admin",
        destination: "/inbox/antisocial-checks",
        permanent: false,
      },
      {
        source: "/antisocial-checks/new",
        destination: "/my/antisocial-checks/new",
        permanent: false,
      },
      { source: "/antisocial-checks", destination: "/my/antisocial-checks", permanent: false },
      // --- shift ---
      { source: "/shift/admin", destination: "/shift-swaps", permanent: false },
      { source: "/shift/inbox", destination: "/inbox/shift-swaps", permanent: false },
      { source: "/shift/manage/new", destination: "/shift-assignments/new", permanent: false },
      { source: "/shift/manage", destination: "/shift-assignments", permanent: false },
      { source: "/shift/patterns/new", destination: "/shift-patterns/new", permanent: false },
      { source: "/shift/patterns", destination: "/shift-patterns", permanent: false },
      { source: "/shift", destination: "/my/shifts", permanent: false },
      // --- thanks（base/send 据え置き） ---
      { source: "/thanks/admin", destination: "/thanks-redemptions", permanent: false },
      { source: "/thanks/inbox", destination: "/inbox/thanks-redemptions", permanent: false },
      { source: "/thanks/rewards/manage", destination: "/rewards/manage", permanent: false },
      { source: "/thanks/rewards", destination: "/rewards", permanent: false },
      // --- review ---
      { source: "/review/manage", destination: "/review-cycles", permanent: false },
      { source: "/review/results", destination: "/reviews", permanent: false },
      { source: "/review", destination: "/my/reviews", permanent: false },
      // --- career ---
      { source: "/career/postings/new", destination: "/job-postings/new", permanent: false },
      { source: "/career/postings/:path*", destination: "/job-postings/:path*", permanent: false },
      { source: "/career/postings", destination: "/job-postings", permanent: false },
      { source: "/career", destination: "/my/career", permanent: false },
      // --- skills / surveys ---
      { source: "/skills/me", destination: "/my/skills", permanent: false },
      { source: "/surveys/responses", destination: "/my/survey-responses", permanent: false },
      // --- assets / rooms ---
      { source: "/assets/lent/me", destination: "/my/assets", permanent: false },
      { source: "/rooms/me", destination: "/my/room-reservations", permanent: false },
      // --- onboarding（employee は並べ替え特例） ---
      {
        source: "/onboarding/employee/:code",
        destination: "/employees/:code/onboarding",
        permanent: false,
      },
      { source: "/onboarding/employees", destination: "/onboarding-assignments", permanent: false },
      {
        source: "/onboarding/assignments/new",
        destination: "/onboarding-assignments/new",
        permanent: false,
      },
      { source: "/onboarding/me", destination: "/my/onboarding-tasks", permanent: false },
      {
        source: "/onboarding/templates/new",
        destination: "/onboarding-templates/new",
        permanent: false,
      },
      { source: "/onboarding/templates", destination: "/onboarding-templates", permanent: false },
      { source: "/onboarding", destination: "/onboarding-assignments", permanent: false },
      // --- org（reporting-line と departments/members は並べ替え特例） ---
      {
        source: "/org/reporting-line/:code",
        destination: "/employees/:code/reporting-line",
        permanent: false,
      },
      {
        source: "/org/departments/:code/members",
        destination: "/departments/:code/members",
        permanent: false,
      },
      { source: "/org/departments/:path*", destination: "/departments/:path*", permanent: false },
      { source: "/org/departments", destination: "/departments", permanent: false },
      { source: "/org", destination: "/departments", permanent: false },
      // --- 組織図は organization へ移設。個別部署 /teams/:code は部署ハブとして存続 ---
      { source: "/teams", destination: "/organization/departments", permanent: false },
      { source: "/teams/new", destination: "/organization/departments/new", permanent: false },
      { source: "/departments", destination: "/organization/departments", permanent: false },
      {
        source: "/departments/new",
        destination: "/organization/departments/new",
        permanent: false,
      },
      { source: "/departments/:path*", destination: "/teams/:path*", permanent: false },
      // --- マイチームと代理承認は部署空間へ移動 ---
      { source: "/my/reports", destination: "/teams/reports", permanent: false },
      {
        source: "/my/approval-delegations",
        destination: "/teams/approval-delegations",
        permanent: false,
      },
      { source: "/me/reports", destination: "/teams/reports", permanent: false },
      // 空間移動の一括転送は個別 redirects より後に置く（先に置くと
      // /applications/inbox 等の具体パスが /organization/... へ先取りされて壊れる）。
      ...spaceRedirects,
    ]
  },

  // CSP is set dynamically per request in middleware.ts with a nonce for script-src.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  silent: process.env.CI !== "true",
  tunnelRoute: "/monitoring",
})
