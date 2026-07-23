import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { RestrictionDateTimePicker } from "@/components/RestrictionDateTimePicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { logInfo, logError } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, ArrowRightLeft, Pencil, Save, History as HistoryIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  WHATSAPP_LABEL,
  EVENT_LABEL,
  STATUS_DOT,
  formatPhone,
  formatDateTime,
  formatRestrictionCountdown,
  getEffectivePhoneStatus,
  parseBrazilDateTimeInput,
  toBrazilDateTimeInputValue,
  type PhoneStatus,
  type WhatsappType,
  type HistoryEvent,
} from "@/lib/phone-utils";
import {
  formatDeviceLocation,
  getFirstAvailableSlot,
  isDeviceSlotTaken,
  type DeviceOccupancy,
  type DeviceOption,
} from "@/lib/device-utils";
import { createRestrictionExpiredNotifications } from "@/lib/restriction-notifications";
type PhoneNumberDetail = {
  id: string;
  phone_number?: string | null;
  carrier_id?: string | null;
  whatsapp_type?: string | null;
  chip_location?: string | null;
  device_id?: string | null;
  device_slot?: number | null;
  observations?: string | null;
  current_employee_id?: string | null;
  status?: string | null;
  employees?: { name?: string | null } | null;
  prev?: { name?: string | null } | null;
  carriers?: { name?: string | null } | null;
  devices?: { name?: string | null } | null;
  registered_at?: string | null;
  activated_at?: string | null;
  restricted_at?: string | null;
  blocked_at?: string | null;
  block_reason?: string | null;
  restriction_duration_days?: number | null;
  restriction_ends_at?: string | null;
  restriction_under_review?: boolean | null;
  deactivated_at?: string | null;
};
export const Route = createFileRoute("/_authenticated/numeros/$id")({
  head: () => ({ meta: [{ title: "Número — Controle WhatsApp" }] }),
  component: NumeroDetail,
});
function NumeroDetail() {
  const { id } = useParams({ from: "/_authenticated/numeros/$id" });
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const numQ = useQuery({
    queryKey: ["number", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_numbers")
        .select(
          "*,employees!current_employee_id(name),prev:employees!previous_employee_id(name),carriers(name),devices(name)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const statsQ = useQuery({
    queryKey: ["number-stats", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_number_stats")
        .select("*")
        .eq("phone_number_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const historyQ = useQuery({
    queryKey: ["number-history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_number_history")
        .select(
          "*,from:employees!from_employee_id(name),to:employees!to_employee_id(name),by:profiles!performed_by(full_name,email)",
        )
        .eq("phone_number_id", id)
        .order("performed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const employeesQ = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id,name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const carriersQ = useQuery({
    queryKey: ["carriers-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carriers")
        .select("id,name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const devicesQ = useQuery({
    queryKey: ["devices-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("id,name,chip_capacity,is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const deviceOccupancyQ = useQuery({
    queryKey: ["phone-device-occupancy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_numbers")
        .select("id,device_id,device_slot");
      if (error) throw error;
      return data;
    },
  });
  function refresh() {
    qc.invalidateQueries({ queryKey: ["number", id] });
    qc.invalidateQueries({ queryKey: ["number-stats", id] });
    qc.invalidateQueries({ queryKey: ["number-history", id] });
    qc.invalidateQueries({ queryKey: ["phone-device-occupancy"] });
    qc.invalidateQueries({ queryKey: ["numbers"] });
    qc.invalidateQueries({ queryKey: ["dashboard-totals"] });
    qc.invalidateQueries({ queryKey: ["dashboard-employees"] });
    qc.invalidateQueries({ queryKey: ["employee-numbers"] });
  }

  useEffect(() => {
    const number = numQ.data;
    if (
      !isAdmin ||
      !number ||
      number.status !== "blocked" ||
      !number.restriction_ends_at ||
      new Date(number.restriction_ends_at).getTime() > now.getTime()
    ) {
      return;
    }

    void createRestrictionExpiredNotifications([
      {
        id: number.id,
        phone_number: number.phone_number ?? "",
        restriction_ends_at: number.restriction_ends_at,
        employees: number.employees,
      },
    ]).then((notificationsCreated) => {
      if (!notificationsCreated) return;

      return supabase
        .from("phone_numbers")
        .update({
          status: "working",
          restricted_at: null,
          restriction_duration_days: null,
          restriction_ends_at: null,
          restriction_under_review: false,
        })
        .eq("id", number.id)
        .then(({ error }) => {
          if (error) {
            logError("Failed to release expired restriction", {
              action: "phone_number.restriction.release_expired",
              phoneNumberId: number.id,
              error,
            });
            return;
          }

          logInfo("Expired restriction released", {
            action: "phone_number.restriction.release_expired",
            phoneNumberId: number.id,
          });

          qc.invalidateQueries({ queryKey: ["number", id] });
          qc.invalidateQueries({ queryKey: ["number-stats", id] });
          qc.invalidateQueries({ queryKey: ["number-history", id] });
          qc.invalidateQueries({ queryKey: ["numbers"] });
          qc.invalidateQueries({ queryKey: ["dashboard-totals"] });
          qc.invalidateQueries({ queryKey: ["dashboard-employees"] });
          qc.invalidateQueries({ queryKey: ["employee-numbers"] });
          qc.invalidateQueries({ queryKey: ["notifications"] });
        });
    });
  }, [id, isAdmin, numQ.data, now, qc]);

  if (numQ.isLoading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-4 py-6">
          <Skeleton className="h-40 w-full" />
        </main>
      </div>
    );
  }
  if (!numQ.data) {
    return (
      <div className="min-h-screen bg-muted/20">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-4 py-6">
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Número não encontrado.
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }
  const n = numQ.data;
  const effectiveStatus = getEffectivePhoneStatus(
    n.status as PhoneStatus,
    n.restriction_ends_at,
    now,
  );
  const stats = statsQ.data;
  const latestTransferObservation =
    historyQ.data?.find((h) => h.event_type === "transferred" && h.observation)?.observation ??
    null;

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Link
          to="/numeros"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold">{formatPhone(n.phone_number)}</h1>
              <button
                type="button"
                onClick={() => setStatusOpen(true)}
                className="rounded-md transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <StatusBadge status={effectiveStatus} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {n.carriers?.name ?? "Sem operadora"} ·{" "}
              {WHATSAPP_LABEL[n.whatsapp_type as WhatsappType]}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setStatusOpen(true)}>
                Mudar status
              </Button>
              <Button variant="outline" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="h-4 w-4 mr-1.5" /> Transferir
              </Button>
              <Button onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1.5" /> Editar
              </Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="space-y-3">
                <Info label="Responsável atual" value={n.employees?.name ?? "—"} />
                <Info label="Cadastro" value={formatDateTime(n.registered_at)} />
                <Info label="Restrição" value={formatDateTime(n.restricted_at ?? n.blocked_at)} />
                {n.status === "blocked" && (
                  <Info
                    label="Tempo restante"
                    value={formatRestrictionCountdown(n.restriction_ends_at, now)}
                  />
                )}
                <Info label="Desativação" value={formatDateTime(n.deactivated_at)} />
                <div>
                  <div className="text-xs text-muted-foreground">Observações</div>
                  <div className="mt-0.5 whitespace-pre-wrap">{n.observations || "—"}</div>
                </div>
              </div>
              <div className="space-y-3">
                <Info label="Responsável anterior" value={n.prev?.name ?? "—"} />
                <Info label="Ativação" value={formatDateTime(n.activated_at)} />
                <Info
                  label="Dispositivo"
                  value={formatDeviceLocation(n.devices?.name, n.device_slot)}
                />
                <div>
                  <div className="text-xs text-muted-foreground">Observações da transferência</div>
                  <div className="mt-0.5 whitespace-pre-wrap">
                    {latestTransferObservation || "—"}
                  </div>
                </div>
                {n.status === "blocked" && (
                  <Info label="Fim da restrição" value={formatDateTime(n.restriction_ends_at)} />
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estatísticas</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <StatItem label="Bloqueios" value={stats?.block_count ?? 0} />
              <StatItem label="Transferências" value={stats?.transfer_count ?? 0} />
              <StatItem label="Ativações" value={stats?.activation_count ?? 0} />
              <StatItem label="Desativações" value={stats?.deactivation_count ?? 0} />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <HistoryIcon className="h-4 w-4" />
              Histórico
            </CardTitle>

            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="status_change">Mudança de status</SelectItem>
                <SelectItem value="transfer">Transferências</SelectItem>
                <SelectItem value="activation">Ativações</SelectItem>
                <SelectItem value="deactivation">Desativações</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {historyQ.isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : (historyQ.data ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                Sem eventos registrados.
              </div>
            ) : (
              <ol className="relative border-l border-border ml-2 space-y-4">
                {historyQ
                  .data!.filter((h) => {
                    switch (historyFilter) {
                      case "all":
                        return true;
                      case "transfer":
                        return h.event_type === "transferred";
                      case "status_change":
                        return ["blocked", "unblocked"].includes(h.event_type);
                      case "activation":
                        return h.event_type === "activated";
                      case "deactivation":
                        return h.event_type === "deactivated";
                      default:
                        return true;
                    }
                  })
                  .map((h) => (
                    <li key={h.id} className="ml-4">
                      <span
                        className={`absolute -left-1.5 w-3 h-3 rounded-full ${
                          h.to_status ? STATUS_DOT[h.to_status as PhoneStatus] : "bg-primary"
                        }`}
                      />
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium">
                          {EVENT_LABEL[h.event_type as HistoryEvent]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(h.performed_at)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5 space-y-0.5">
                        {h.from_status && h.to_status && (
                          <div>
                            De <b>{STATUS_LABEL[h.from_status as PhoneStatus]}</b> para{" "}
                            <b>{STATUS_LABEL[h.to_status as PhoneStatus]}</b>
                          </div>
                        )}
                        {h.to_employee_id && (
                          <div>
                            Responsável:{" "}
                            {h.from?.name && (
                              <>
                                {" "}
                                de <b>{h.from.name}</b>
                              </>
                            )}{" "}
                            para <b>{h.to?.name ?? "—"}</b>
                          </div>
                        )}
                        {h.reason && <div>Motivo: {h.reason}</div>}
                        {h.observation && <div>Observações da transferência: {h.observation}</div>}
                        <div>Por: {h.by?.full_name || h.by?.email || "Sistema"}</div>
                      </div>
                    </li>
                  ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </main>

      <EditNumberDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        number={n}
        employees={employeesQ.data ?? []}
        carriers={carriersQ.data ?? []}
        devices={devicesQ.data ?? []}
        occupiedNumbers={deviceOccupancyQ.data ?? []}
        onSaved={refresh}
      />
      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        number={n}
        employees={employeesQ.data ?? []}
        onSaved={refresh}
      />
      <StatusDialog open={statusOpen} onOpenChange={setStatusOpen} number={n} onSaved={refresh} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function EditNumberDialog({
  open,
  onOpenChange,
  number,
  employees,
  carriers,
  devices,
  occupiedNumbers,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  number: PhoneNumberDetail;
  employees: { id: string; name: string }[];
  carriers: { id: string; name: string }[];
  devices: DeviceOption[];
  occupiedNumbers: DeviceOccupancy[];
  onSaved: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [whatsapp, setWhatsapp] = useState<WhatsappType>("business");
  const [deviceId, setDeviceId] = useState("none");
  const [deviceSlot, setDeviceSlot] = useState("none");
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPhone(number.phone_number ?? "");
      setCarrierId(number.carrier_id ?? "");
      setWhatsapp((number.whatsapp_type as WhatsappType) ?? "business");
      setDeviceId(number.device_id ?? "none");
      setDeviceSlot(number.device_slot ? String(number.device_slot) : "none");
      setObservations(number.observations ?? "");
    }
  }, [open, number]);

  const selectedDevice = devices.find((device) => device.id === deviceId);

  function handleDeviceChange(value: string) {
    setDeviceId(value);
    if (value === "none") {
      setDeviceSlot("none");
      return;
    }

    const device = devices.find((item) => item.id === value);
    setDeviceSlot(getFirstAvailableSlot(occupiedNumbers, device, number.id));
  }

  function handleDeviceSlotChange(value: string) {
    setDeviceSlot(value);
    if (value === "none") {
      setDeviceId("none");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("phone_numbers")
      .update({
        phone_number: phone.replace(/\D/g, ""),
        carrier_id: carrierId || null,
        whatsapp_type: whatsapp,
        device_id: deviceId === "none" || deviceSlot === "none" ? null : deviceId,
        device_slot: deviceId === "none" || deviceSlot === "none" ? null : Number(deviceSlot),
        chip_location: null,
        observations: observations.trim() || null,
      })
      .eq("id", number.id);
    if (error) {
      logError("Failed to update phone number", {
        action: "phone_number.update",
        phoneNumberId: number.id,
        error,
      });

      return toast.error(error.message);
    }

    logInfo("Phone number updated", {
      action: "phone_number.update",
      phoneNumberId: number.id,
    });

    toast.success("Alterações salvas.");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar número</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Número</Label>
            <Input required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Operadora</Label>
              <Select value={carrierId} onValueChange={setCarrierId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {carriers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Select value={whatsapp} onValueChange={(v) => setWhatsapp(v as WhatsappType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="none">Sem WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Dispositivo</Label>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
              <Select value={deviceId} onValueChange={handleDeviceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o aparelho" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem chip</SelectItem>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={deviceSlot}
                onValueChange={handleDeviceSlotChange}
                disabled={deviceId === "none"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem chip</SelectItem>
                  {[1, 2].map((slot) => {
                    const disabled =
                      !selectedDevice ||
                      slot > selectedDevice.chip_capacity ||
                      isDeviceSlotTaken(occupiedNumbers, selectedDevice.id, slot, number.id);

                    return (
                      <SelectItem key={slot} value={String(slot)} disabled={disabled}>
                        Chip {slot}
                        {disabled && selectedDevice && slot <= selectedDevice.chip_capacity
                          ? " - ocupado"
                          : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-1.5" />
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({
  open,
  onOpenChange,
  number,
  employees,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  number: PhoneNumberDetail;
  employees: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [target, setTarget] = useState<string>("none");
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTarget("none");
      setObservation("");
    }
  }, [open]);

  async function handleTransfer() {
    if (target && target === number.current_employee_id) {
      return toast.error("Selecione uma colaboradora diferente.");
    }
    setSaving(true);
    const transferObservation = observation.trim();
    const { error } = await supabase
      .from("phone_numbers")
      .update({ current_employee_id: target === "none" ? null : target })
      .eq("id", number.id);
    if (error) {
      setSaving(false);
      logError("Failed to transfer phone number", {
        action: "phone_number.transfer",
        phoneNumberId: number.id,
        targetEmployeeId: target === "none" ? null : target,
        error,
      });

      return toast.error(error.message);
    }

    if (transferObservation) {
      const { data: latestTransfer, error: latestTransferError } = await supabase
        .from("phone_number_history")
        .select("id")
        .eq("phone_number_id", number.id)
        .eq("event_type", "transferred")
        .order("performed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestTransferError) {
        setSaving(false);
        logError("Failed to find transfer history entry", {
          action: "phone_number.transfer_observation.lookup",
          phoneNumberId: number.id,
          error: latestTransferError,
        });

        return toast.error(latestTransferError.message);
      }

      if (latestTransfer?.id) {
        const { error: observationError } = await supabase
          .from("phone_number_history")
          .update({ observation: transferObservation })
          .eq("id", latestTransfer.id);

        if (observationError) {
          setSaving(false);
          logError("Failed to save transfer observation", {
            action: "phone_number.transfer_observation.update",
            phoneNumberId: number.id,
            historyId: latestTransfer.id,
            error: observationError,
          });

          return toast.error(observationError.message);
        }
      }
    }

    setSaving(false);
    logInfo("Phone number transferred", {
      action: "phone_number.transfer",
      phoneNumberId: number.id,
      targetEmployeeId: target === "none" ? null : target,
      hasObservation: Boolean(transferObservation),
    });

    toast.success("Transferência registrada.");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir número</DialogTitle>
          <DialogDescription>
            Atual: <b>{number.employees?.name ?? "Sem responsável"}</b>. O histórico será
            preservado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Novo responsável</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem responsável</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Observações da transferência</Label>
          <Textarea
            rows={3}
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Ex.: Chip transferido porque a colaboradora mudou de aparelho."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleTransfer} disabled={saving}>
            Confirmar transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusDialog({
  open,
  onOpenChange,
  number,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  number: PhoneNumberDetail;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<PhoneStatus>("working");
  const [reason, setReason] = useState("");
  const [restrictionEndsAt, setRestrictionEndsAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(number.status as PhoneStatus);
      setReason(number.block_reason ?? "");
      setRestrictionEndsAt(toBrazilDateTimeInputValue(number.restriction_ends_at));
    }
  }, [open, number]);

  async function handleSave() {
    if (status === number.status && status !== "blocked") return onOpenChange(false);
    const payload: {
      status: PhoneStatus;
      block_reason?: string | null;
      restricted_at?: string | null;
      restriction_duration_days?: number | null;
      restriction_ends_at?: string | null;
      restriction_under_review?: boolean;
    } = { status };
    if (status === "blocked") {
      const endsAt = parseBrazilDateTimeInput(restrictionEndsAt);
      if (!endsAt) {
        return toast.error("Informe quando a restrição acaba no formato dd/mm/aaaa hh:mm.");
      }
      if (endsAt.getTime() <= Date.now()) {
        return toast.error("O fim da restrição precisa estar no futuro.");
      }
      payload.restricted_at = number.restricted_at ?? number.blocked_at ?? new Date().toISOString();
      payload.restriction_duration_days = null;
      payload.restriction_ends_at = endsAt.toISOString();
      payload.restriction_under_review = false;
      payload.block_reason = reason.trim() || null;
    } else {
      payload.restricted_at = null;
      payload.restriction_duration_days = null;
      payload.restriction_ends_at = null;
      payload.restriction_under_review = false;
    }
    setSaving(true);
    const { error } = await supabase.from("phone_numbers").update(payload).eq("id", number.id);
    setSaving(false);
    if (error) {
      logError("Failed to update phone number status", {
        action: "phone_number.status_update",
        phoneNumberId: number.id,
        fromStatus: number.status,
        toStatus: status,
        error,
      });

      return toast.error(error.message);
    }

    logInfo("Phone number status updated", {
      action: "phone_number.status_update",
      phoneNumberId: number.id,
      fromStatus: number.status,
      toStatus: status,
    });

    toast.success("Status atualizado.");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar status</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Novo status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as PhoneStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {status === "blocked" && (
            <>
              <div className="space-y-1.5">
                <Label>Fim da restrição</Label>
                <RestrictionDateTimePicker
                  value={restrictionEndsAt}
                  onChange={setRestrictionEndsAt}
                />
                <p className="text-xs text-muted-foreground">
                  Contagem:{" "}
                  {formatRestrictionCountdown(
                    parseBrazilDateTimeInput(restrictionEndsAt)?.toISOString(),
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Motivo da restrição (opcional)</Label>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
