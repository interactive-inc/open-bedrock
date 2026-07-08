"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

function Collapsible({
  className,
  ...props
}: CollapsiblePrimitive.Root.Props & { className?: string }) {
  return (
    <CollapsiblePrimitive.Root
      data-slot="collapsible"
      className={`group/collapsible ${className ?? ""}`.trim()}
      {...props}
    />
  )
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
}

function CollapsibleContent({
  className,
  style,
  ...props
}: CollapsiblePrimitive.Panel.Props & { className?: string; style?: React.CSSProperties }) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={className}
      keepMounted
      style={{
        height: "var(--collapsible-panel-height)",
        overflow: "hidden",
        transition: "height 0.3s ease",
        ...style,
      }}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
