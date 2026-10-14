import type { Practitioner, Service } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PractitionerEditor, type EditorPractitioner } from "../marketplace/PractitionerEditor";

/**
 * The practitioner record and public-profile editor. [props frozen: self-contained, critique 32]
 *
 * Rendered by the team pages (WP6) with only the props below; everything else (who is looking,
 * whether they may approve the profile or remove themselves from the marketplace) is read here
 * from the session. A server component: only the fields the editor needs reach the browser.
 *
 * - Managers (team.manage) get the full form: details, treatments and the public-profile tab.
 * - The practitioner themselves (their linked account) without team.manage get the preview with
 *   approval and "remove me from the marketplace" (render it for them too: see docs/marketplace.md).
 */
export async function PractitionerForm({
  practitioner,
  services,
  offered,
}: {
  practitioner?: Practitioner;
  services: Service[];
  offered: string[];
}) {
  const s = await requireStaff();
  const isSelf = Boolean(practitioner?.userId && practitioner.userId === s.user.id);
  const p: EditorPractitioner | null = practitioner
    ? {
        id: practitioner.id,
        title: practitioner.title,
        name: practitioner.name,
        specialty: practitioner.specialty,
        bio: practitioner.bio,
        color: practitioner.color,
        licenseNumber: practitioner.licenseNumber,
        acceptsNewPatients: practitioner.acceptsNewPatients,
        active: practitioner.active,
        spokenLanguages: practitioner.spokenLanguages ?? [],
        specializations: practitioner.specializations ?? [],
        careOptions: practitioner.careOptions ?? {},
        alboProvince: practitioner.alboProvince,
        alboNumber: practitioner.alboNumber,
        alboVerifiedAt: practitioner.alboVerifiedAt,
        publicProfile: practitioner.publicProfile,
        profileApprovedAt: practitioner.profileApprovedAt,
        marketplaceOptOutAt: practitioner.marketplaceOptOutAt,
      }
    : null;
  return (
    <PractitionerEditor
      key={practitioner?.id ?? "new"}
      practitioner={p}
      services={services.map((x) => ({ id: x.id, name: x.name, category: x.category }))}
      offered={offered}
      viewer={{ canManage: can(s.role, "team.manage"), canApprove: s.role === "owner" || isSelf, isSelf }}
      org={{ timezone: s.org.timezone }}
    />
  );
}
