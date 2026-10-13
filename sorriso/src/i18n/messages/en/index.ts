/**
 * The English dictionary: the type source for every key (SourceMessages) and the runtime
 * fallback for every other locale.
 */
import type { Namespace } from "../../namespaces";
import type { WideLeaves } from "../../types";
import common from "./common";
import consents from "./consents";
import site from "./site";
import a11y from "./a11y";
import booking from "./booking";
import manage from "./manage";
import errors from "./errors";
import accessibility from "./accessibility";
import dashboard from "./dashboard";
import calendar from "./calendar";
import analytics from "./analytics";
import patientMessages from "./patientMessages";
import reminders from "./reminders";
import privacy from "./privacy";
import legalPatient from "./legalPatient";
import privacyMessages from "./privacyMessages";
import privacyAdmin from "./privacyAdmin";
import legalPractice from "./legalPractice";
import privacyAdminEmails from "./privacyAdminEmails";
import auth from "./auth";
import security from "./security";
import authEmails from "./authEmails";
import marketplace from "./marketplace";
import reviews from "./reviews";
import catalog from "./catalog";
import reviewEmails from "./reviewEmails";
import care from "./care";
import careMessages from "./careMessages";

const en = {
  common,
  consents,
  site,
  a11y,
  booking,
  manage,
  errors,
  accessibility,
  dashboard,
  calendar,
  analytics,
  patientMessages,
  reminders,
  privacy,
  legalPatient,
  privacyMessages,
  privacyAdmin,
  legalPractice,
  privacyAdminEmails,
  auth,
  security,
  authEmails,
  marketplace,
  reviews,
  catalog,
  reviewEmails,
  care,
  careMessages,
} satisfies Record<Namespace, object>;

/**
 * Every English leaf keeps its literal type (`as const` in each file): keys, placeholders and
 * plurals are typed from it, and a widened leaf would let t() compile without its arguments.
 * A file that drops `as const` fails here with the widened keys in the message.
 */
type AssertLiteral<Widened extends never> = Widened;
export type EnglishLeavesAreLiteral = AssertLiteral<WideLeaves<typeof en>>;

export default en;
