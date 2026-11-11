import * as React from "react"
import { cn } from "@/lib/utils"

const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  const base = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99] cursor-pointer"
  
  const variants = {
    default: "bg-navy-900 text-white shadow hover:bg-navy-800",
    primary: "bg-blue-600 text-white shadow hover:bg-blue-700",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    outline: "border border-slate-300 bg-white hover:bg-slate-50 text-slate-700",
    ghost: "hover:bg-slate-100 text-slate-700",
    emerald: "bg-emerald-600 text-white shadow hover:bg-emerald-700",
    destructive: "bg-rose-600 text-white shadow hover:bg-rose-700"
  }

  const sizes = {
    default: "h-11 px-5 py-2.5",
    sm: "h-9 rounded-lg px-3 text-xs",
    lg: "h-12 rounded-xl px-7 text-base font-semibold",
    icon: "h-10 w-10"
  }

  return (
    <button
      className={cn(base, variants[variant] || variants.default, sizes[size] || sizes.default, className)}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }

