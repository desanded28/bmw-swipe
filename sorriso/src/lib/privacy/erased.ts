/**
 * The placeholder identity of an erased (pseudonymised) record: first + last name read
 * "Paziente cancellato". Its own module so requests.ts can recognise erased reviews without
 * importing erasure.ts (which imports requests.ts).
 */
export const ERASED_FIRST_NAME = "Paziente";
export const ERASED_LAST_NAME = "cancellato";
export const ERASED_NAME = `${ERASED_FIRST_NAME} ${ERASED_LAST_NAME}`;
