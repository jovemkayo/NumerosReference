import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, AlertTriangle, PowerOff, Ban, Users, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { STATUS_LABEL, getEffectivePhoneStatus, type PhoneStatus } from "@/lib/phone-utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Controle de Números WhatsApp" },
      {
        name: "description",
        content: "Visão geral de números, colaboradoras e status.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [q, setQ] = useState("");

  const totalsQ = useQuery({
    queryKey: ["dashboard-totals"],
    queryFn: async () => {
      const now = new Date();
      const { data, error } = await supabase
        .from("phone_numbers")
        .select("status,restriction_ends_at");
      if (error) throw error;
      const counts = {
        total: data.length,
        working: 0,
        restricted: 0,
        deactivated: 0,
        permanently_banned: 0,
      };
      for (const r of data) {
        const status = getEffectivePhoneStatus(r.status as PhoneStatus, r.restriction_ends_at, now);
        if (status === "working") counts.working++;
        else if (status == "blocked") counts.restricted++;
        else if (status === "deactivated") counts.deactivated++;
        else if (status === "permanently_banned") counts.permanently_banned++;
      }
      return counts;
    },
  });

  const employeesQ = useQuery({
    queryKey: ["dashboard-employees"],
    queryFn: async () => {
      const [{ data: emps, error: e1 }, { data: nums, error: e2 }] = await Promise.all([
        supabase.from("employees").select("id,name,is_active,photo_path").order("name"),
        supabase.from("phone_numbers").select("current_employee_id,status,restriction_ends_at"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      type S = {
        total: number;
        working: number;
        restricted: number;
        deactivated: number;
        permanently_banned: number;
      };
      const empty = (): S => ({
        total: 0,
        working: 0,
        restricted: 0,
        deactivated: 0,
        permanently_banned: 0,
      });
      const byEmp = new Map<string, S>();
      const now = new Date();
      for (const n of nums ?? []) {
        if (!n.current_employee_id) continue;
        const acc = byEmp.get(n.current_employee_id) ?? empty();
        const status = getEffectivePhoneStatus(n.status as PhoneStatus, n.restriction_ends_at, now);
        acc.total++;
        if (status === "working") acc.working++;
        else if (status === "blocked") acc.restricted++;
        else if (status === "deactivated") acc.deactivated++;
        else if (status === "permanently_banned") acc.permanently_banned++;
        byEmp.set(n.current_employee_id, acc);
      }
      return (emps ?? []).map((e) => ({
        ...e,
        stats: byEmp.get(e.id) ?? empty(),
      }));
    },
  });
  const filtered = useMemo(() => {
    const list = employeesQ.data ?? [];
    const s = q.trim().toLowerCase();
    return s ? list.filter((e) => e.name.toLowerCase().includes(s)) : list;
  }, [employeesQ.data, q]);

  const t = totalsQ.data;

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do sistema.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <StatCard
            label="Total de números"
            value={t?.total}
            icon={<Phone className="h-4 w-4" />}
            loading={totalsQ.isLoading}
          />
          <StatCard
            label={STATUS_LABEL.blocked}
            value={t?.restricted}
            icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
            loading={totalsQ.isLoading}
          />
          <StatCard
            label={STATUS_LABEL.deactivated}
            value={t?.deactivated}
            icon={<PowerOff className="h-4 w-4 text-gray-500" />}
            loading={totalsQ.isLoading}
          />
          <StatCard
            label={STATUS_LABEL.permanently_banned}
            value={t?.permanently_banned}
            icon={<Ban className="h-4 w-4" />}
            loading={totalsQ.isLoading}
          />
          <StatCard
            label="Colaboradoras"
            value={employeesQ.data?.length}
            icon={<Users className="h-4 w-4" />}
            loading={employeesQ.isLoading}
          />
        </div>

        <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Colaboradoras</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar colaboradora..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {employeesQ.isLoading ? (
          <div className="grid gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma colaboradora encontrada.{" "}
              <Link to="/funcionarias" className="text-primary underline">
                Cadastrar agora
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filtered.map((e) => (
              <Link key={e.id} to="/funcionarias/$id" params={{ id: e.id }}>
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4 flex items-center gap-3">
                    <EmployeeAvatar name={e.name} photoPath={e.photo_path} className="h-10 w-10" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium truncate">{e.name}</div>
                        {!e.is_active && (
                          <span className="text-xs text-muted-foreground">(desativada)</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                        <span>{e.stats.total} números</span>
                        {e.stats.working > 0 && (
                          <span className="text-emerald-600">{e.stats.working} funcionando</span>
                        )}
                        {e.stats.restricted > 0 && (
                          <span className="text-orange-600">{e.stats.restricted} restringidos</span>
                        )}
                        {e.stats.deactivated > 0 && (
                          <span className="text-gray-500">{e.stats.deactivated} desativados</span>
                        )}
                        {e.stats.permanently_banned > 0 && (
                          <span className="text-black">{e.stats.permanently_banned} banidos</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
function StatCard({
  label,
  value,
  icon,
  loading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs mb-2">
          <span className="truncate">{label}</span>
          {icon}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-12" />
        ) : (
          <div className="text-2xl font-semibold">{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}
