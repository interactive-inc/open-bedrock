import { defineMain } from "@storybook/nextjs/node"

export default defineMain({
  stories: ["../components/**/*.stories.@(ts|tsx)", "../app/**/*.stories.@(ts|tsx)"],
  framework: "@storybook/nextjs",
})
