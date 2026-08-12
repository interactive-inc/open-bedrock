import { createFactory } from "hono/factory"

const factory = createFactory()

// @authorization public - 稼働確認は認証前に到達できてよい
export const GET = factory.createHandlers((context) => context.json({ status: "ok" }, 200))
