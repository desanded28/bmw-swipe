"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { getAppointmentDetails } from "@/lib/appointments";
import { newId } from "@/lib/ids";

export async function submitReview(token: string, _prev: { error?: string } | null, formData: FormData) {
  const d = await getAppointmentDetails({ token });
  if (!d || d.appointment.status !== "completed") return { error: "Reviews open after your visit is completed." };
  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Please choose a rating from 1 to 5 stars." };
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 2000) || null;
  const showName = formData.get("showName") === "on";
  const [existing] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.appointmentId, d.appointment.id));
  if (existing) return { error: "You've already reviewed this visit. Thank you!" };
  await db.insert(reviews).values({
    id: newId(),
    orgId: d.org.id,
    practitionerId: d.practitioner.id,
    appointmentId: d.appointment.id,
    rating,
    comment,
    authorName: showName ? `${d.patient.firstName} ${d.patient.lastName.charAt(0)}.` : "Verified patient",
  });
  redirect(`/a/${token}/review?thanks=1`);
}
