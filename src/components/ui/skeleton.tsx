import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-skeleton
      className={cn("animate-pulse rounded-md bg-primary/35", className)}
      {...props}
    />
  )
}

export { Skeleton }
