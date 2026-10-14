/**
 * The neutral reply templates practices can start from (reviews.reply.templateTexts.*). Shared by
 * the reviews page (server: picks the texts in the review's language) and ReviewReply (client).
 */
export const REPLY_TEMPLATES = ["thanks", "sorry", "neutral"] as const;
export type ReplyTemplateKey = (typeof REPLY_TEMPLATES)[number];
export type ReplyTemplates = Record<ReplyTemplateKey, string>;
