import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, STATUS_COLOR, type PhoneStatus } from "@/lib/phone-utils";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: PhoneStatus; className?: string }) {
  return (
    <Badge className={cn(STATUS_COLOR[status], "border-transparent hover:opacity-90", className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
