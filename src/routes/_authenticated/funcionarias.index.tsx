import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { logInfo, logError } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Power, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/funcionarias/")({
  head: () => ({ meta: [{ title: "Colaboradoras — Controle WhatsApp" }] }),
  component: FuncionariasPage,
});

type Employee = {
  id: string;
  name: string;
  is_active: boolean;
  notes: string | null;
  photo_path: string | null;
};

const EMPLOYEE_PHOTO_BUCKET = "employee-photos";
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

function FuncionariasPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Employee | null>(null);
  const { isAdmin } = useAuth();

  const employeesQ = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const [{ data: emps, error }, { data: nums, error: numsError }] = await Promise.all([
        supabase.from("employees").select("id,name,is_active,notes,photo_path").order("name"),
        supabase.from("phone_numbers").select("current_employee_id"),
      ]);

      if (error) {
        logError("Failed to load employees", {
          action: "employee.list",
          error,
        });

        throw error;
      }

      if (numsError) {
        logError("Failed to load employee phone counts", {
          action: "employee.phone_count",
          error: numsError,
        });

        throw numsError;
      }
      const counts = new Map<string, number>();
      for (const n of nums ?? [])
        if (n.current_employee_id)
          counts.set(n.current_employee_id, (counts.get(n.current_employee_id) ?? 0) + 1);
      return (emps ?? []).map((e) => ({ ...e, count: counts.get(e.id) ?? 0 }));
    },
  });

  const filtered = useMemo(() => {
    const list = employeesQ.data ?? [];
    const s = q.trim().toLowerCase();
    return list.filter(
      (e) =>
        (showInactive ? !e.is_active : e.is_active) && (!s || e.name.toLowerCase().includes(s)),
    );
  }, [employeesQ.data, q, showInactive]);

  const toggleActive = useMutation({
    mutationFn: async (emp: Employee) => {
      const { error } = await supabase
        .from("employees")
        .update({ is_active: !emp.is_active })
        .eq("id", emp.id);
      if (error) throw error;
    },
    onSuccess: (_d, emp) => {
      toast.success(emp.is_active ? "Colaboradora desativada." : "Colaboradora reativada.");
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard-employees"] });
      setToggleTarget(null);
    },
    onError: (e: Error, emp) => {
      logError("Failed to toggle employee active status", {
        action: "employee.toggle_active",
        employeeId: emp.id,
        targetActive: !emp.is_active,
        error: e,
      });

      toast.error(e.message);
    },
  });

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Colaboradoras</h1>
            <p className="text-sm text-muted-foreground">Cadastre e gerencie as colaboradoras.</p>
          </div>
          {isAdmin && (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Nova colaboradora
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={showInactive ? "default" : "outline"}
            onClick={() => setShowInactive((v) => !v)}
            className="sm:w-auto"
          >
            {showInactive ? "Ocultar desativadas" : "Mostrar desativadas"}
          </Button>
        </div>

        {employeesQ.isLoading ? (
          <div className="grid gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma colaboradora encontrada.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {filtered.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <Link
                    to="/funcionarias/$id"
                    params={{ id: e.id }}
                    className="flex-1 min-w-0 flex items-center gap-3"
                  >
                    <EmployeeAvatar name={e.name} photoPath={e.photo_path} className="h-9 w-9" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        {e.name}
                        {!e.is_active && (
                          <Badge variant="secondary" className="text-[10px]">
                            Desativada
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.count} números atribuídos
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(e);
                            setDialogOpen(true);
                          }}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setToggleTarget(e)}
                          title={e.is_active ? "Desativar" : "Reativar"}
                        >
                          <Power className={`h-4 w-4 ${e.is_active ? "" : "text-emerald-600"}`} />
                        </Button>
                      </>
                    )}
                    <Link to="/funcionarias/$id" params={{ id: e.id }} className="hidden sm:flex">
                      <Button variant="ghost" size="icon">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["employees"] });
          qc.invalidateQueries({ queryKey: ["dashboard-employees"] });
        }}
      />

      <AlertDialog open={!!toggleTarget} onOpenChange={(o) => !o && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.is_active ? "Desativar colaboradora?" : "Reativar colaboradora?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.is_active
                ? "Ela deixará de aparecer nas listas ativas. Todos os dados e histórico são preservados."
                : "Ela voltará a aparecer nas listas ativas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleTarget && toggleActive.mutate(toggleTarget)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employee: Employee | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(employee?.name ?? "");
      setNotes(employee?.notes ?? "");
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      setRemovePhoto(false);
    }
  }, [open, employee]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  async function uploadEmployeePhoto(employeeId: string, file: File) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Selecione um arquivo de imagem.");
    }

    if (file.size > MAX_PHOTO_SIZE) {
      throw new Error("A foto precisa ter no máximo 5 MB.");
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${employeeId}/${Date.now()}.${safeExtension}`;
    const { error } = await supabase.storage.from(EMPLOYEE_PHOTO_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (error) throw error;
    return path;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        notes: notes.trim() || null,
        ...(removePhoto ? { photo_path: null } : {}),
      };
      const savedEmployee = employee
        ? await supabase
            .from("employees")
            .update(payload)
            .eq("id", employee.id)
            .select("id")
            .single()
        : await supabase.from("employees").insert(payload).select("id").single();

      if (savedEmployee.error) throw savedEmployee.error;

      const previousPhotoPath = employee?.photo_path ?? null;

      if (photoFile) {
        const photoPath = await uploadEmployeePhoto(savedEmployee.data.id, photoFile);
        const { error: photoError } = await supabase
          .from("employees")
          .update({ photo_path: photoPath })
          .eq("id", savedEmployee.data.id);

        if (photoError) throw photoError;
      }

      if (previousPhotoPath && (photoFile || removePhoto)) {
        await supabase.storage.from(EMPLOYEE_PHOTO_BUCKET).remove([previousPhotoPath]);
      }

      logInfo("Employee saved", {
        action: employee ? "employee.update" : "employee.create",
        employeeId: savedEmployee.data.id,
        hasPhotoUpload: Boolean(photoFile),
        removePhoto,
      });

      toast.success(employee ? "Colaboradora atualizada." : "Colaboradora cadastrada.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      logError("Failed to save employee", {
        action: employee ? "employee.update" : "employee.create",
        employeeId: employee?.id,
        error,
      });

      const message = error instanceof Error ? error.message : "Não foi possível salvar.";
      toast.error(
        message.includes("bucket") || message.includes("policy") || message.includes("permission")
          ? `${message}. Verifique se a migration das fotos foi aplicada no Supabase.`
          : message,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee ? "Editar colaboradora" : "Nova colaboradora"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="e-name">Nome</Label>
            <Input
              id="e-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-notes">Observações (opcional)</Label>
            <Textarea
              id="e-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-photo">Foto (opcional)</Label>
            <div className="flex items-center gap-3">
              {photoPreviewUrl ? (
                <img
                  src={photoPreviewUrl}
                  alt="Prévia da foto"
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <EmployeeAvatar
                  name={name || employee?.name || "?"}
                  photoPath={removePhoto ? null : employee?.photo_path}
                  className="h-14 w-14"
                />
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  id="e-photo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    setPhotoFile(event.target.files?.[0] ?? null);
                    setRemovePhoto(false);
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {photoFile && (
                    <span className="text-xs text-muted-foreground truncate">
                      Nova foto: {photoFile.name}
                    </span>
                  )}
                  {employee?.photo_path && !removePhoto && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPhotoFile(null);
                        setRemovePhoto(true);
                      }}
                    >
                      Remover foto
                    </Button>
                  )}
                </div>
              </div>
            </div>
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
