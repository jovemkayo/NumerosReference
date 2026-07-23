import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ExternalLink, Inbox, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logError, logInfo } from "@/lib/logger";
import { formatDateTime, formatPhone } from "@/lib/phone-utils";

type NotificationRow = {
  id: string;
  type: string;
  phone_number_id: string | null;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  phone_numbers?: {
    phone_number?: string | null;
    employees?: { name?: string | null } | null;
  } | null;
};

export function NotificationsFloatingButton() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const notificationsQ = useQuery({
    queryKey: ["notifications"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*,phone_numbers(phone_number,employees!current_employee_id(name))")
        .order("read_at", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  const markReadM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      logError("Failed to mark notification as read", {
        action: "notification.mark_read",
        error,
      });
      toast.error("Não foi possível marcar como lida.");
    },
  });

  const markAllReadM = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      logInfo("All notifications marked as read", {
        action: "notification.mark_all_read",
      });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notificações marcadas como lidas.");
    },
    onError: (error) => {
      logError("Failed to mark all notifications as read", {
        action: "notification.mark_all_read",
        error,
      });
      toast.error("Não foi possível marcar todas como lidas.");
    },
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notificação excluída.");
    },
    onError: (error) => {
      logError("Failed to delete notification", {
        action: "notification.delete",
        error,
      });
      toast.error("Não foi possível excluir a notificação.");
    },
  });

  if (!isAdmin) return null;

  const notifications = notificationsQ.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-lg md:bottom-6 md:right-6"
          aria-label="Abrir notificações"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full bg-orange-500 px-1 text-[11px] font-semibold leading-5 text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div>
              <SheetTitle>Notificações</SheetTitle>
              <div className="text-sm text-muted-foreground">
                Avisos sobre restrições encerradas.
              </div>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadM.mutate()}
                disabled={markAllReadM.isPending}
              >
                <CheckCheck className="mr-1.5 h-4 w-4" />
                Ler todas
              </Button>
            )}
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {notificationsQ.isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, index) => (
                <Skeleton key={index} className="h-24" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              <div className="font-medium">Nenhuma notificação</div>
              <div className="max-w-64 text-sm text-muted-foreground">
                Quando um prazo de restrição encerrar, o aviso aparece aqui.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-md border p-3 ${
                    !notification.read_at ? "border-orange-300 bg-orange-50/40" : "bg-background"
                  }`}
                >
                  <div className="mb-2 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">{notification.title}</div>
                        {!notification.read_at && <Badge>Nova</Badge>}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {notification.message}
                      </div>
                    </div>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatDateTime(notification.created_at)}</span>
                    {notification.phone_numbers?.phone_number && (
                      <span>{formatPhone(notification.phone_numbers.phone_number)}</span>
                    )}
                    {notification.phone_numbers?.employees?.name && (
                      <span>{notification.phone_numbers.employees.name}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {notification.phone_number_id && (
                      <Button asChild variant="outline" size="sm">
                        <Link to="/numeros/$id" params={{ id: notification.phone_number_id }}>
                          <ExternalLink className="mr-1.5 h-4 w-4" />
                          Abrir
                        </Link>
                      </Button>
                    )}
                    {!notification.read_at && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markReadM.mutate(notification.id)}
                        disabled={markReadM.isPending}
                      >
                        <CheckCheck className="mr-1.5 h-4 w-4" />
                        Lida
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteM.mutate(notification.id)}
                      disabled={deleteM.isPending}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
