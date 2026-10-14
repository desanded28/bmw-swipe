/** English source for the legalPractice namespace. Owned by WP5 (practice GDPR). */
export default {
  /**
   * Instructions to people authorised to process patient data (GDPR Art. 29 and 32(4), Art.
   * 2-quaterdecies Codice privacy), accepted by every member on joining (WP6's invite flow) and
   * whenever LEGAL_VERSIONS.staff_instructions changes (WP5's gate). Italian is authoritative.
   */
  staffInstructions: {
    title: "Instructions for staff handling patient data",
    intro:
      "You are authorised to process patients' personal data, including health data, on behalf of the practice. Follow these instructions in every part of your work.",
    confidentiality:
      "Keep everything you learn about patients confidential, during and after your work with the practice. Never discuss patients where others can hear or see.",
    needToKnow:
      "Open only the patients and appointments you need for your task. Your role decides what you can see; don't ask colleagues for access you don't have.",
    freeText:
      "Don't write health information in fields shared outside the practice, such as messages to patients, calendar entries or notes sent to other providers. Clinical details belong in the clinical record.",
    breaches:
      "Report a lost device, a message sent to the wrong person or any other possible breach to the practice owner immediately: the practice has 72 hours to notify the Garante.",
    personalDevices:
      "Don't copy, export or forward patient data to personal devices, personal email or messaging accounts, or any service the practice hasn't approved.",
    calendarSync:
      "If you sync your schedule to a personal calendar, keep the minimal detail setting: times only, without patient names or treatments.",
    accessLog:
      "Every access to patient data is recorded in an audit log that the practice may review to protect patients. The log is not used to monitor your performance.",
    accept: "I have read these instructions and will follow them",
    version: "Version {version}",
  },
} as const;
