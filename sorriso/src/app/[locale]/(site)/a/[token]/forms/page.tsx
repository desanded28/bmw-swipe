import { redirect } from "next/navigation";
import { toLocale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { TOKEN_SHAPE } from "@/lib/forms";

/** The only form today is the medical history: /a/<token>/forms opens it. */
export default async function FormsIndex({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  redirect(lhref(toLocale(locale), TOKEN_SHAPE.test(token) ? `/a/${token}/forms/anamnesis` : "/"));
}
