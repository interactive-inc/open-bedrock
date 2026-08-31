import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/i18n/use-translator", () => ({ useTranslator: () => (value: string) => value }))
vi.mock("@/components/login-form", () => ({ LoginForm: () => <form /> }))

import { LoginPage } from "@/components/login-page"

const originalAppName = process.env.NEXT_PUBLIC_APP_NAME

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_NAME = originalAppName
})

describe("LoginPage", () => {
  test("設定されたアプリ名をログイン見出しに表示する", () => {
    process.env.NEXT_PUBLIC_APP_NAME = "Bedrock"

    render(<LoginPage />)

    expect(screen.getByText("Bedrock にサインイン")).toBeDefined()
  })
})
