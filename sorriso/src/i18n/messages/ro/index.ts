/** All namespaces of this locale, as written (registry.ts merges them over English). */
import type { PartialMessages } from "../../types";
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

export default {
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
} satisfies PartialMessages;
