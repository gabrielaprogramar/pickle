import { z } from "zod";

export const resendAttachmentSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1),
  content_type: z.string().min(1),
});

export const resendWebhookSchema = z.object({
  subject: z.string().nullable().optional(),
  from: z.string().email(),
  to: z.array(z.string().email()).min(1),
  text: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
  attachments: z.array(resendAttachmentSchema).optional().default([]),
  message_id: z.string().min(1),
  created_at: z.string().min(1),
}).strict();

export type ResendWebhookInput = z.infer<typeof resendWebhookSchema>;
