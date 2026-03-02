import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva(
    "relative w-full rounded-base border-2 border-border px-4 py-3 text-sm shadow-shadow",
    {
        variants: {
            variant: {
                default: "bg-main text-main-foreground",
                destructive: "bg-black text-white",
            },
        },
        defaultVariants: { variant: "default" },
    },
)

function Alert({ className, variant, ...props }) {
    return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}
function AlertTitle({ className, ...props }) {
    return <div data-slot="alert-title" className={cn("font-heading tracking-tight mb-1", className)} {...props} />
}
function AlertDescription({ className, ...props }) {
    return <div data-slot="alert-description" className={cn("text-sm font-base", className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription }
