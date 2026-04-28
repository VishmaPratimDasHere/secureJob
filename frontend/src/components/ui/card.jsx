import { cn } from "@/lib/utils"

function Card({ className, ...props }) {
    return (
        <div data-slot="card" className={cn("rounded-base flex flex-col shadow-shadow border-2 gap-6 py-6 border-border bg-background text-foreground font-base", className)} {...props} />
    )
}
function CardHeader({ className, ...props }) {
    return <div data-slot="card-header" className={cn("grid auto-rows-min items-start gap-1.5 px-6", className)} {...props} />
}
function CardTitle({ className, ...props }) {
    return <div data-slot="card-title" className={cn("font-heading leading-none text-lg", className)} {...props} />
}
function CardDescription({ className, ...props }) {
    return <div data-slot="card-description" className={cn("text-sm font-base", className)} {...props} />
}
function CardContent({ className, ...props }) {
    return <div data-slot="card-content" className={cn("px-6", className)} {...props} />
}
function CardFooter({ className, ...props }) {
    return <div data-slot="card-footer" className={cn("flex items-center px-6", className)} {...props} />
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
