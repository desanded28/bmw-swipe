import { and, asc, count, eq, like, or, sql } from "drizzle-orm";
import { Search, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { fmtDay, zonedDate } from "@/lib/datefmt";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Patients" };

const PAGE = 50;

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const digits = q.replace(/\D/g, "");
  const filter = q
    ? or(
        and(...words.map((w) => or(like(sql`lower(${patients.firstName})`, `%${w}%`), like(sql`lower(${patients.lastName})`, `%${w}%`)))),
        digits.length >= 3 ? like(patients.phone, `%${digits}%`) : undefined,
        like(patients.email, `%${q.toLowerCase()}%`),
      )
    : undefined;
  const where = and(eq(patients.orgId, s.org.id), filter);
  const now = Date.now();

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        p: patients,
        next: sql<number | null>`(select min(starts_at) from appointments a where a.patient_id = ${patients.id} and a.starts_at > ${now} and a.status in ('scheduled','requested'))`,
        last: sql<number | null>`(select max(starts_at) from appointments a where a.patient_id = ${patients.id} and a.status = 'completed')`,
        visits: sql<number>`(select count(*) from appointments a where a.patient_id = ${patients.id} and a.status = 'completed')`,
      })
      .from(patients)
      .where(where)
      .orderBy(asc(patients.lastName), asc(patients.firstName))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db.select({ total: count() }).from(patients).where(where),
  ]);
  const tz = s.org.timezone;
  const day = (ms: number | null) => (ms ? fmtDay(zonedDate(new Date(ms), tz), "weekday") : "—");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Patients" description={`${total} patient${total === 1 ? "" : "s"}${q ? ` matching “${q}”` : ""}`} />
      <form className="relative mb-4 max-w-md">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <Input name="q" defaultValue={q} placeholder="Search name, phone or email" className="pl-9" />
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No patients found" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Next visit</th>
                <th className="px-4 py-2.5">Last visit</th>
                <th className="px-4 py-2.5 text-right">Visits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ p, next, last, visits }) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/patients/${p.id}`} className="font-semibold hover:underline">
                      {p.lastName} {p.firstName}
                    </Link>
                    {p.noShowCount ? (
                      <Badge tone="red" className="ml-2">
                        <UserX size={11} /> {p.noShowCount}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {formatPhone(p.phone)}
                    {p.email ? <span className="block text-xs text-slate-400">{p.email}</span> : null}
                  </td>
                  <td className="px-4 py-2.5">{day(next)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{day(last)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {total > PAGE ? (
        <div className="mt-4 flex justify-between text-sm font-semibold">
          {page > 1 ? <Link href={`?q=${encodeURIComponent(q)}&page=${page - 1}`}>← Previous</Link> : <span />}
          {page * PAGE < total ? <Link href={`?q=${encodeURIComponent(q)}&page=${page + 1}`}>Next →</Link> : null}
        </div>
      ) : null}
    </div>
  );
}
