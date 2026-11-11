import * as React from "react"
import { cn } from "@/lib/utils"

function Badge({ className, variant = "default", ...props }) {
  const variants = {
    default: "border-transparent bg-navy-900 text-white",
    secondary: "border-transparent bg-slate-100 text-slate-800",
    outline: "border-slate-300 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    destructive: "border-rose-200 bg-rose-50 text-rose-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-navy-800"
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variants[variant] || variants.default,
        className
      )}
      {...props}
    />
  )
}

export { Badge }

