import { eq } from "drizzle-orm";
import { BadgeCheck, Heart } from "lucide-react";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/ReviewForm";
import { Card, LinkButton } from "@/components/ui";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { getAppointmentDetails } from "@/lib/appointments";
import { practitionerName } from "@/lib/format";
import { submitReview } from "./actions";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ thanks?: string }>;
}) {
  const { token } = await params;
  const d = await getAppointmentDetails({ token });
  if (!d) notFound();
  const { thanks } = await searchParams;
  const [existing] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.appointmentId, d.appointment.id));

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card className="p-7">
        {thanks || existing ? (
          <div className="text-center">
            <Heart size={40} className="mx-auto fill-rose-400 text-rose-400" />
            <h1 className="mt-3 text-2xl font-extrabold">Thank you!</h1>
            <p className="mt-2 text-slate-600">Your verified review helps other patients choose with confidence.</p>
            <LinkButton href={`/c/${d.org.slug}`} variant="secondary" className="mt-5">
              Back to {d.org.name}
            </LinkButton>
          </div>
        ) : d.appointment.status !== "completed" ? (
          <p className="text-center text-slate-600">You&apos;ll be able to leave a review after your visit.</p>
        ) : (
          <>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <BadgeCheck size={14} /> Verified visit
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight">How was your visit with {practitionerName(d.practitioner)}?</h1>
            <p className="mb-5 mt-1 text-sm text-slate-500">
              {d.service.name} at {d.org.name}
            </p>
            <ReviewForm action={submitReview.bind(null, token)} />
          </>
        )}
      </Card>
    </div>
  );
}
