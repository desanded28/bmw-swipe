import { BookingError } from "../booking";

/** The ActionResult code dashboard actions answer when a recent re-authentication is needed. */
export const STEP_UP_REQUIRED = "step_up_required";

/**
 * Thrown by requireStepUp() inside a server action. It extends BookingError only because the
 * frozen guard() (src/app/dashboard/actions/_shared.ts) turns a BookingError into
 * fail(err.message, err.code): the action then answers { ok: false, code: "step_up_required" }
 * with a localised message, and the client sends the user to /dashboard/account/security/verify.
 */
export class StepUpRequiredError extends BookingError {
  constructor(message = "Please confirm it's you to continue.") {
    super("not_allowed", message);
    this.name = "StepUpRequiredError";
    (this as { code: string }).code = STEP_UP_REQUIRED;
  }
}

export function isStepUpRequired(err: unknown): err is StepUpRequiredError {
  return err instanceof StepUpRequiredError;
}
