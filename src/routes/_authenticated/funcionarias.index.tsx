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
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Power, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/funcionarias/")({
  head: () => ({ meta: [{ title: "Funcionárias — Controle WhatsApp" }] }),
  component: FuncionariasPage,
});

type Employee = { id: string; name: string; is_active: boolean; notes: string | null };

function FuncionariasPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Employee | null>(null);

  const employeesQ = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const [{ data: emps, error }, { data: nums }] = await Promise.all([
        supabase.from("employees").select("id,name,is_active,notes").order("name"),
        supabase.from("phone_numbers").select("current_employee_id"),
      ]);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const n of nums ?? []) if (n.current_employee_id) counts.set(n.current_employee_id, (counts.get(n.current_employee_id) ?? 0) + 1);
      return (emps ?? []).map((e) => ({ ...e, count: counts.get(e.id) ?? 0 }));
    },
  });

  const filtered = useMemo(() => {
    const list = employeesQ.data ?? [];
    const s = q.trim().toLowerCase();
    return list.filter((e) => (showInactive || e.is_active) && (!s || e.name.toLowerCase().includes(s)));
  }, [employeesQ.data, q, showInactive]);

  const toggleActive = useMutation({
    mutationFn: async (emp: Employee) => {
      const { error } = await supabase.from("employees").update({ is_active: !emp.is_active }).eq("id", emp.id);
      if (error) throw error;
    },
    onSuccess: (_d, emp) => {
      toast.success(emp.is_active ? "Funcionária desativada." : "Funcionária reativada.");
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard-employees"] });
      setToggleTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Funcionárias</h1>
            <p className="text-sm text-muted-foreground">Cadastre e gerencie as funcionárias.</p>
          </div>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Nova funcionária
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Button variant={showInactive ? "default" : "outline"} onClick={() => setShowInactive((v) => !v)} className="sm:w-auto">
            {showInactive ? "Ocultar desativadas" : "Mostrar desativadas"}
          </Button>
        </div>

        {employeesQ.isLoading ? (
          <div className="grid gap-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma funcionária encontrada.</CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {filtered.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <Link to="/funcionarias/$id" params={{ id: e.id }} className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                      {e.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        {e.name}
                        {!e.is_active && <Badge variant="secondary" className="text-[10px]">Desativada</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{e.count} números atribuídos</div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(e); setDialogOpen(true); }} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setToggleTarget(e)} title={e.is_active ? "Desativar" : "Reativar"}>
                      <Power className={`h-4 w-4 ${e.is_active ? "" : "text-emerald-600"}`} />
                    </Button>
                    <Link to="/funcionarias/$id" params={{ id: e.id }} className="hidden sm:flex">
                      <Button variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button>
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
            <AlertDialogTitle>{toggleTarget?.is_active ? "Desativar funcionária?" : "Reativar funcionária?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.is_active
                ? "Ela deixará de aparecer nas listas ativas. Todos os dados e histórico são preservados."
                : "Ela voltará a aparecer nas listas ativas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleTarget && toggleActive.mutate(toggleTarget)}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmployeeDialog({
  open, onOpenChange, employee, onSaved,
}: { open: boolean; onOpenChange: (o: boolean) => void; employee: Employee | null; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset when dialog opens
  useMemo(() => {
    if (open) {
      setName(employee?.name ?? "");
      setNotes(employee?.notes ?? "");
    }
  }, [open, employee]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const payload = { name: name.trim(), notes: notes.trim() || null };
    const { error } = employee
      ? await supabase.from("employees").update(payload).eq("id", employee.id)
      : await supabase.from("employees").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(employee ? "Funcionária atualizada." : "Funcionária cadastrada.");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee ? "Editar funcionária" : "Nova funcionária"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="e-name">Nome</Label>
            <Input id="e-name" required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-notes">Observações (opcional)</Label>
            <Textarea id="e-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
