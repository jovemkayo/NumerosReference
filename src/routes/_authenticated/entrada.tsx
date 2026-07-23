import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime, formatPhone } from "@/lib/phone-utils";
import { logError, logInfo } from "@/lib/logger";
import { Bell, CheckCheck, ExternalLink, Inbox, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/entrada")({
  head: () => ({ meta: [{ title: "Entrada - Controle WhatsApp" }] }),
  component: EntradaPage,
});

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

function EntradaPage() {
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

  const notifications = notificationsQ.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Entrada</h1>
            <p className="text-sm text-muted-foreground">
              Notificações importantes dos números telefônicos.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={() => markAllReadM.mutate()}
              disabled={markAllReadM.isPending}
            >
              <CheckCheck className="mr-1.5 h-4 w-4" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {!isAdmin ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Apenas admins podem acessar a caixa de entrada.
            </CardContent>
          </Card>
        ) : notificationsQ.isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              <div className="font-medium">Nenhuma notificação</div>
              <div className="text-sm text-muted-foreground">
                Quando um prazo de restrição encerrar, o aviso aparece aqui.
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={!notification.read_at ? "border-orange-300 bg-orange-50/40" : ""}
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <div className="font-medium">{notification.title}</div>
                      {!notification.read_at && <Badge>Nova</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">{notification.message}</div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatDateTime(notification.created_at)}</span>
                      {notification.phone_numbers?.phone_number && (
                        <span>{formatPhone(notification.phone_numbers.phone_number)}</span>
                      )}
                      {notification.phone_numbers?.employees?.name && (
                        <span>{notification.phone_numbers.employees.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
