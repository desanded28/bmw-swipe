import { notFound } from "next/navigation";

/** Unknown dashboard paths render dashboard/not-found inside the dashboard root layout. */
export default function DashboardCatchAll() {
  notFound();
}
