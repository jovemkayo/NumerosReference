import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type EmployeeAvatarProps = {
  name: string;
  photoPath?: string | null;
  className?: string;
  fallbackClassName?: string;
};

export function EmployeeAvatar({
  name,
  photoPath,
  className,
  fallbackClassName,
}: EmployeeAvatarProps) {
  const photoQ = useQuery({
    queryKey: ["employee-photo-url", photoPath],
    enabled: Boolean(photoPath),
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("employee-photos")
        .createSignedUrl(photoPath!, 60 * 60);

      if (error) throw error;
      return data.signedUrl;
    },
  });

  return (
    <Avatar className={className}>
      {photoQ.data && <AvatarImage src={photoQ.data} alt={name} className="object-cover" />}
      <AvatarFallback className={cn("bg-primary/10 font-semibold text-primary", fallbackClassName)}>
        {name[0]?.toUpperCase() ?? "?"}
      </AvatarFallback>
    </Avatar>
  );
}
