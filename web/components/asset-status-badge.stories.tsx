import type { Meta, StoryObj } from "@storybook/react-vite"
import { AssetStatusBadge } from "@/components/asset-status-badge"

const meta = {
  title: "components/AssetStatusBadge",
  component: AssetStatusBadge,
} satisfies Meta<typeof AssetStatusBadge>

export default meta

type Story = StoryObj<typeof meta>

export const InStock: Story = {
  args: { status: "in_stock" },
}

export const Lent: Story = {
  args: { status: "lent" },
}

export const UnknownStatus: Story = {
  args: { status: "disposed" },
}
