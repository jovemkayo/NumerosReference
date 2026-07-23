import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logError, logInfo } from "@/lib/logger";
import { formatPhone, type PhoneStatus } from "@/lib/phone-utils";
import { ChevronDown, ChevronsUpDown, Plus, Search, Smartphone, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dispositivos")({
  head: () => ({ meta: [{ title: "Dispositivos - Controle WhatsApp" }] }),
  component: DispositivosPage,
});

type Device = {
  id: string;
  name: string;
  chip_capacity: number;
  is_active: boolean;
};

type NumberOccupancy = {
  id: string;
  phone_number: string | null;
  status: PhoneStatus | null;
  device_id: string | null;
  device_slot: number | null;
  employees?: { name?: string | null } | null;
};

type SlotTarget = {
  device: Device;
  slot: number | null;
  currentNumber?: NumberOccupancy;
};

function DispositivosPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [slotTarget, setSlotTarget] = useState<SlotTarget | null>(null);
  const [openDeviceIds, setOpenDeviceIds] = useState<Set<string>>(new Set());
  const [unassignedOpen, setUnassignedOpen] = useState(true);
  const [deviceOpenStateReady, setDeviceOpenStateReady] = useState(false);

  const devicesQ = useQuery({
    queryKey: ["devices"],
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

  const numbersQ = useQuery({
    queryKey: ["phone-device-occupancy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_numbers")
        .select("id,phone_number,status,device_id,device_slot,employees!current_employee_id(name)")
        .order("phone_number");
      if (error) throw error;
      return data;
    },
  });

  const numbers = useMemo(() => (numbersQ.data ?? []) as NumberOccupancy[], [numbersQ.data]);

  const occupancyByDeviceSlot = useMemo(() => {
    const map = new Map<string, NumberOccupancy>();

    for (const number of numbers) {
      if (!number.device_id || !number.device_slot) continue;
      map.set(`${number.device_id}:${number.device_slot}`, number);
    }

    return map;
  }, [numbers]);

  const numberWithoutChipByDevice = useMemo(() => {
    const map = new Map<string, NumberOccupancy>();

    for (const number of numbers) {
      if (!number.device_id || number.device_slot) continue;
      if (!map.has(number.device_id)) {
        map.set(number.device_id, number);
      }
    }

    return map;
  }, [numbers]);

  const unassignedNumbers = useMemo(() => numbers.filter((number) => !number.device_id), [numbers]);

  const filteredDevices = useMemo(() => {
    const search = q.trim().toLowerCase();
    const devices = (devicesQ.data ?? []) as Device[];
    if (!search) return devices;

    return devices.filter((device) => {
      const assignedNumbers = [1, 2]
        .map((slot) => occupancyByDeviceSlot.get(`${device.id}:${slot}`))
        .filter(Boolean);
      const numberWithoutChip = numberWithoutChipByDevice.get(device.id);

      const hay = [
        device.name,
        numberWithoutChip?.phone_number ?? "",
        ...assignedNumbers.map((number) => number?.phone_number ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(search);
    });
  }, [devicesQ.data, numberWithoutChipByDevice, occupancyByDeviceSlot, q]);

  const allDeviceIds = useMemo(() => {
    return ((devicesQ.data ?? []) as Device[]).map((device) => device.id);
  }, [devicesQ.data]);

  const filteredUnassignedNumbers = useMemo(() => {
    const search = q.trim().toLowerCase();
    if (!search) return unassignedNumbers;
    return unassignedNumbers.filter((number) => (number.phone_number ?? "").includes(search));
  }, [q, unassignedNumbers]);

  const showUnassigned =
    !q.trim() ||
    "sem dispositivos".includes(q.trim().toLowerCase()) ||
    filteredUnassignedNumbers.length > 0;

  const loading = devicesQ.isLoading || numbersQ.isLoading;
  const allVisibleBlocksOpen =
    (!showUnassigned || unassignedOpen) &&
    filteredDevices.every((device) => openDeviceIds.has(device.id));

  useEffect(() => {
    if (deviceOpenStateReady || allDeviceIds.length === 0) return;
    setOpenDeviceIds(new Set(allDeviceIds));
    setDeviceOpenStateReady(true);
  }, [allDeviceIds, deviceOpenStateReady]);

  function openNewDeviceDialog() {
    setEditingDevice(null);
    setDeviceDialogOpen(true);
  }

  function openEditDeviceDialog(device: Device) {
    setEditingDevice(device);
    setDeviceDialogOpen(true);
  }

  function expandAllDevices() {
    setOpenDeviceIds(new Set(allDeviceIds));
    setUnassignedOpen(true);
    setDeviceOpenStateReady(true);
  }

  function collapseAllDevices() {
    setOpenDeviceIds(new Set());
    setUnassignedOpen(false);
    setDeviceOpenStateReady(true);
  }

  function toggleAllDevices() {
    if (allVisibleBlocksOpen) {
      collapseAllDevices();
    } else {
      expandAllDevices();
    }
  }

  function setDeviceOpen(deviceId: string, open: boolean) {
    setOpenDeviceIds((current) => {
      const next = new Set(current);
      if (open) {
        next.add(deviceId);
      } else {
        next.delete(deviceId);
      }
      return next;
    });
    setDeviceOpenStateReady(true);
  }

  function openFirstAvailableSlot(device: Device) {
    for (let slot = 1; slot <= device.chip_capacity; slot += 1) {
      const currentNumber = occupancyByDeviceSlot.get(`${device.id}:${slot}`);
      if (!currentNumber) {
        setSlotTarget({ device, slot });
        setDeviceOpen(device.id, true);
        return;
      }
    }

    toast.error("Esse dispositivo não tem chip livre.");
  }

  async function refreshDevices() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["devices"] }),
      qc.invalidateQueries({ queryKey: ["devices-active"] }),
      qc.invalidateQueries({ queryKey: ["phone-device-occupancy"] }),
      qc.invalidateQueries({ queryKey: ["numbers"] }),
      qc.invalidateQueries({ queryKey: ["employee-numbers"] }),
    ]);
  }

  async function handleRemoveDevice(device: Device) {
    const usedSlots = [1, 2].filter((slot) => occupancyByDeviceSlot.get(`${device.id}:${slot}`));
    if (usedSlots.length > 0) {
      toast.error("Remova os chips desse dispositivo antes de remover o aparelho.");
      return;
    }

    const confirmed = window.confirm(`Remover o dispositivo ${device.name}?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("devices")
      .update({ is_active: false })
      .eq("id", device.id);

    if (error) {
      logError("Failed to remove device", {
        action: "device.remove",
        deviceId: device.id,
        error,
      });

      toast.error(error.message);
      return;
    }

    logInfo("Device removed", {
      action: "device.remove",
      deviceId: device.id,
    });

    toast.success("Dispositivo removido.");
    await refreshDevices();
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Dispositivos</h1>
            <p className="text-sm text-muted-foreground">
              Veja e edite onde cada número está encaixado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{filteredDevices.length} aparelhos</Badge>
            {isAdmin && (
              <Button onClick={openNewDeviceDialog}>
                <Plus className="h-4 w-4 mr-1.5" /> Novo dispositivo
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mb-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar aparelho ou número..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleAllDevices}
            title={allVisibleBlocksOpen ? "Fechar todos" : "Abrir todos"}
            aria-label={allVisibleBlocksOpen ? "Fechar todos" : "Abrir todos"}
          >
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : filteredDevices.length === 0 && !showUnassigned ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhum dispositivo encontrado.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {showUnassigned && (
              <UnassignedCard
                numbers={filteredUnassignedNumbers}
                total={unassignedNumbers.length}
                open={unassignedOpen}
                onOpenChange={setUnassignedOpen}
              />
            )}
            {filteredDevices.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
                {filteredDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    isAdmin={isAdmin}
                    open={openDeviceIds.has(device.id)}
                    onOpenChange={(open) => setDeviceOpen(device.id, open)}
                    getSlot={(slot) => occupancyByDeviceSlot.get(`${device.id}:${slot}`)}
                    numberWithoutChip={numberWithoutChipByDevice.get(device.id)}
                    onRemoveDevice={() => handleRemoveDevice(device)}
                    onAddNumber={() => openFirstAvailableSlot(device)}
                    onEditSlot={(slot, currentNumber) =>
                      setSlotTarget({ device, slot, currentNumber })
                    }
                    onEditWithoutChip={(currentNumber) =>
                      setSlotTarget({ device, slot: null, currentNumber })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <DeviceDialog
        open={deviceDialogOpen}
        onOpenChange={setDeviceDialogOpen}
        device={editingDevice}
        onSaved={refreshDevices}
      />
      {slotTarget && (
        <SlotDialog
          open={Boolean(slotTarget)}
          onOpenChange={(open) => {
            if (!open) setSlotTarget(null);
          }}
          target={slotTarget}
          numbers={numbers}
          onSaved={refreshDevices}
        />
      )}
    </div>
  );
}

function DeviceCard({
  device,
  isAdmin,
  open,
  onOpenChange,
  getSlot,
  numberWithoutChip,
  onRemoveDevice,
  onAddNumber,
  onEditSlot,
  onEditWithoutChip,
}: {
  device: Device;
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getSlot: (slot: number) => NumberOccupancy | undefined;
  numberWithoutChip?: NumberOccupancy;
  onRemoveDevice: () => void;
  onAddNumber: () => void;
  onEditSlot: (slot: number, currentNumber?: NumberOccupancy) => void;
  onEditWithoutChip: (currentNumber?: NumberOccupancy) => void;
}) {
  const usedSlots = [1, 2].filter((slot) => getSlot(slot)).length;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card>
        <CardHeader className="px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Smartphone className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-base leading-5">{device.name}</CardTitle>
                <div className="whitespace-nowrap text-xs leading-4 text-muted-foreground">
                  {usedSlots}/{device.chip_capacity} chips ocupados
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge variant={usedSlots >= device.chip_capacity ? "default" : "secondary"}>
                {usedSlots >= device.chip_capacity ? "Ocupado" : "Disponível"}
              </Badge>
              {isAdmin && (
                <>
                  <Button type="button" size="icon" variant="ghost" onClick={onAddNumber}>
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Adicionar número</span>
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={onRemoveDevice}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remover dispositivo</span>
                  </Button>
                </>
              )}
              <CollapsibleTrigger asChild>
                <Button type="button" size="icon" variant="ghost">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                  <span className="sr-only">{open ? "Minimizar" : "Abrir"} dispositivo</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-2">
            {[1, 2].map((slot) => (
              <DeviceSlot
                key={slot}
                slot={slot}
                capacity={device.chip_capacity}
                number={getSlot(slot)}
                isAdmin={isAdmin}
                onEdit={() => onEditSlot(slot, getSlot(slot))}
              />
            ))}
            <DeviceSlot
              label="Sem chip"
              number={numberWithoutChip}
              isAdmin={isAdmin}
              onEdit={() => onEditWithoutChip(numberWithoutChip)}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function DeviceSlot({
  slot,
  capacity,
  label,
  number,
  isAdmin,
  onEdit,
}: {
  slot?: number;
  capacity?: number;
  label?: string;
  number?: NumberOccupancy;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  if (slot && capacity && slot > capacity) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        Chip {slot}: indisponível
      </div>
    );
  }

  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">{label ?? `Chip ${slot}`}</div>
        <div className="flex items-center gap-2">
          <Badge variant={number ? "outline" : "secondary"}>{number ? "Ocupado" : "Livre"}</Badge>
          {isAdmin && (
            <Button type="button" size="sm" variant="outline" onClick={onEdit}>
              Editar
            </Button>
          )}
        </div>
      </div>

      {number ? (
        <Link to="/numeros/$id" params={{ id: number.id }} className="mt-2 block">
          <div className="transition-colors hover:text-primary">
            <div>{formatPhone(number.phone_number ?? "")}</div>
            <div className="text-xs text-muted-foreground">
              {number.employees?.name ?? "Sem responsável"}
            </div>
          </div>
        </Link>
      ) : (
        <div className="mt-2 text-xs text-emerald-600">Sem chip</div>
      )}
    </div>
  );
}

function UnassignedCard({
  numbers,
  total,
  open,
  onOpenChange,
}: {
  numbers: NumberOccupancy[];
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card>
        <CardHeader className="px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Smartphone className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-base leading-5">Sem dispositivos</CardTitle>
                <div className="whitespace-nowrap text-xs leading-4 text-muted-foreground">
                  {total} números sem dispositivo
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge variant="secondary">Livre</Badge>
              <CollapsibleTrigger asChild>
                <Button type="button" size="icon" variant="ghost">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                  <span className="sr-only">{open ? "Minimizar" : "Abrir"} sem dispositivos</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {numbers.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Nenhum número sem dispositivo.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {numbers.map((number) => (
                  <Link
                    key={number.id}
                    to="/numeros/$id"
                    params={{ id: number.id }}
                    className="block"
                  >
                    <div className="rounded-md border p-3 text-sm transition-colors hover:border-primary/50">
                      <div>{formatPhone(number.phone_number ?? "")}</div>
                      <div className="text-xs text-muted-foreground">
                        {number.employees?.name ?? "Sem responsável"}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function DeviceDialog({
  open,
  onOpenChange,
  device,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: Device | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(device?.name ?? "");
  }, [device, open]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const normalizedName = name.trim().toUpperCase();
    if (!normalizedName) {
      toast.error("Informe o nome do dispositivo.");
      return;
    }

    setSaving(true);
    const payload = {
      name: normalizedName,
      chip_capacity: 2,
      is_active: true,
    };

    const { error } = device
      ? await supabase.from("devices").update(payload).eq("id", device.id)
      : await supabase.from("devices").insert(payload);

    setSaving(false);

    if (error) {
      logError("Failed to save device", {
        action: device ? "device.update" : "device.create",
        deviceId: device?.id,
        error,
      });

      toast.error(error.message);
      return;
    }

    logInfo("Device saved", {
      action: device ? "device.update" : "device.create",
      deviceId: device?.id,
    });

    toast.success(device ? "Dispositivo atualizado." : "Dispositivo criado.");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{device ? "Editar dispositivo" : "Novo dispositivo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="PAULA 03" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SlotDialog({
  open,
  onOpenChange,
  target,
  numbers,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: SlotTarget;
  numbers: NumberOccupancy[];
  onSaved: () => void;
}) {
  const [selectedNumberId, setSelectedNumberId] = useState(target.currentNumber?.id ?? "none");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);

    if (target.currentNumber?.id && selectedNumberId !== target.currentNumber.id) {
      const { error } = await supabase
        .from("phone_numbers")
        .update({ device_id: null, device_slot: null, chip_location: null })
        .eq("id", target.currentNumber.id);

      if (error) {
        setSaving(false);
        logError("Failed to clear device slot", {
          action: "device.slot.clear",
          deviceId: target.device.id,
          slot: target.slot,
          phoneNumberId: target.currentNumber.id,
          error,
        });

        toast.error(error.message);
        return;
      }
    }

    if (selectedNumberId !== "none") {
      const { error } = await supabase
        .from("phone_numbers")
        .update({
          device_id: target.device.id,
          device_slot: target.slot,
          chip_location: null,
        })
        .eq("id", selectedNumberId);

      if (error) {
        setSaving(false);
        logError("Failed to assign device slot", {
          action: "device.slot.assign",
          deviceId: target.device.id,
          slot: target.slot,
          phoneNumberId: selectedNumberId,
          error,
        });

        toast.error(error.message);
        return;
      }
    }

    setSaving(false);
    logInfo("Device slot updated", {
      action: "device.slot.update",
      deviceId: target.device.id,
      slot: target.slot,
      phoneNumberId: selectedNumberId === "none" ? null : selectedNumberId,
    });

    toast.success("Chip atualizado.");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Editar {target.device.name} - {target.slot ? `Chip ${target.slot}` : "Sem chip"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>{target.slot ? "Número neste chip" : "Número sem chip"}</Label>
          <Select value={selectedNumberId} onValueChange={setSelectedNumberId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem número</SelectItem>
              {numbers.map((number) => (
                <SelectItem key={number.id} value={number.id}>
                  {formatPhone(number.phone_number ?? "")} -{" "}
                  {number.employees?.name ?? "Sem responsável"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
