import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Search, Phone, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  WHATSAPP_LABEL,
  formatPhone,
  type PhoneStatus,
  type WhatsappType,
} from "@/lib/phone-utils";
import { logInfo, logError } from "@/lib/logger";

export const Route = createFileRoute("/_authenticated/numeros/")({
  head: () => ({ meta: [{ title: "Números — Controle WhatsApp" }] }),
  component: NumerosPage,
});

function NumerosPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PhoneStatus>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { isAdmin } = useAuth();

  const numbersQ = useQuery({
    queryKey: ["numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_numbers")
        .select(
          "id,phone_number,status,whatsapp_type,current_employee_id,carrier_id,employees!current_employee_id(name),carriers(name)",
        )
        .order("created_at", { ascending: false });
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

  const filtered = useMemo(() => {
    const list = numbersQ.data ?? [];
    const s = q.trim().toLowerCase();
    return list.filter((n) => {
      if (statusFilter !== "all" && n.status !== statusFilter) return false;
      if (employeeFilter === "unassigned" && n.current_employee_id) return false;
      if (
        employeeFilter !== "all" &&
        employeeFilter !== "unassigned" &&
        n.current_employee_id !== employeeFilter
      )
        return false;
      if (s) {
        const hay =
          `${n.phone_number} ${n.employees?.name ?? ""} ${n.carriers?.name ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [numbersQ.data, q, statusFilter, employeeFilter]);

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Números</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre e gerencie os números telefônicos.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Novo número
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Colaboradora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas colaboradoras</SelectItem>
              <SelectItem value="unassigned">Sem responsável</SelectItem>
              {(employeesQ.data ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {numbersQ.isLoading ? (
          <div className="grid gap-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhum número encontrado.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {filtered.map((n) => (
              <Link key={n.id} to="/numeros/$id" params={{ id: n.id }}>
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{formatPhone(n.phone_number)}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {n.employees?.name ?? "Sem responsável"} ·{" "}
                        {n.carriers?.name ?? "Sem operadora"} ·{" "}
                        {WHATSAPP_LABEL[n.whatsapp_type as WhatsappType]}
                      </div>
                    </div>
                    <StatusBadge status={n.status as PhoneStatus} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <NewNumberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employees={employeesQ.data ?? []}
        carriers={carriersQ.data ?? []}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["numbers"] });
          qc.invalidateQueries({ queryKey: ["dashboard-totals"] });
          qc.invalidateQueries({ queryKey: ["dashboard-employees"] });
        }}
      />
    </div>
  );
}

function NewNumberDialog({
  open,
  onOpenChange,
  employees,
  carriers,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employees: { id: string; name: string }[];
  carriers: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [carrierId, setCarrierId] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("none");
  const [whatsapp, setWhatsapp] = useState<WhatsappType>("business");
  const [status, setStatus] = useState<PhoneStatus>("working");
  const [chipLocation, setChipLocation] = useState("");
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPhone("");
      setEmployeeId("none");
      setWhatsapp("business");
      setStatus("working");
      setChipLocation("");
      setObservations("");
      setCarrierId(carriers[0]?.id ?? "");
    }
  }, [open, carriers]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return toast.error("Número inválido.");
    setSaving(true);
    const { error } = await supabase.from("phone_numbers").insert({
      phone_number: digits,
      carrier_id: carrierId || null,
      current_employee_id: employeeId === "none" ? null : employeeId,
      whatsapp_type: whatsapp,
      status,
      chip_location: chipLocation.trim() || null,
      observations: observations.trim() || null,
    });
    setSaving(false);
    if (error) {
      logError("Failed to create phone number", {
        action: "phone_number.create",
        error,
        carrierId,
        employeeId,
        status,
        whatsapp,
      });

      return toast.error(error.message);
    }

    logInfo("Phone number created", {
      action: "phone_number.create",
      carrierId,
      employeeId,
      status,
      whatsapp,
    });

    toast.success("Número cadastrado.");
    onCreated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo número</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="n-phone">Número telefônico</Label>
              <Input
                id="n-phone"
                required
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Operadora</Label>
              <Select value={carrierId} onValueChange={setCarrierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
              <Label>Responsável</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue />
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
              <Label>WhatsApp</Label>
              <Select value={whatsapp} onValueChange={(v) => setWhatsapp(v as WhatsappType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">WhatsApp Business</SelectItem>
                  <SelectItem value="normal">WhatsApp Normal</SelectItem>
                  <SelectItem value="none">Sem WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Onde está o chip?</Label>
              <Input
                placeholder="Ex.: Aparelho MARIANA 01"
                value={chipLocation}
                onChange={(e) => setChipLocation(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="n-obs">Observações</Label>
              <Textarea
                id="n-obs"
                rows={2}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
