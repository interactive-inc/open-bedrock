import type { Metadata } from "next"
import { LoginGate } from "@/components/login-gate"

export const metadata: Metadata = {
  title: "サインイン",
}

export default function LoginPage() {
  return <LoginGate />
}
