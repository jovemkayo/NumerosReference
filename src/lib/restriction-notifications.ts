import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatPhone } from "@/lib/phone-utils";
import { logError } from "@/lib/logger";

type ExpiredRestrictionNumber = {
  id: string;
  phone_number: string;
  restriction_ends_at: string | null;
  employees?: { name?: string | null } | null;
};

export async function createRestrictionExpiredNotifications(
  numbers: ExpiredRestrictionNumber[],
): Promise<boolean> {
  if (numbers.length === 0) return true;

  const { error } = await supabase.from("notifications").upsert(
    numbers.map((number) => ({
      type: "restriction_expired",
      phone_number_id: number.id,
      title: "Prazo de restrição encerrado",
      message: `${formatPhone(number.phone_number)} saiu da restrição${
        number.employees?.name ? ` (${number.employees.name})` : ""
      }.`,
      metadata: {
        restriction_ends_at: number.restriction_ends_at,
        restriction_ends_at_label: formatDateTime(number.restriction_ends_at),
      },
    })),
    {
      onConflict: "type,phone_number_id",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    logError("Failed to create restriction expiration notifications", {
      action: "notification.restriction_expired.create",
      count: numbers.length,
      error,
    });
    return false;
  }

  return true;
}
