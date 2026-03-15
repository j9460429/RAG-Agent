import { z } from 'zod'

export const TelegramChatSchema = z.object({
  id: z.number(),
  type: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  title: z.string().optional(),
})

export const TelegramUserSchema = z.object({
  id: z.number(),
  is_bot: z.boolean(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
})

export const TelegramDocumentSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  file_name: z.string().optional(),
  mime_type: z.string().optional(),
  file_size: z.number().optional(),
})

export const TelegramPhotoSizeSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  width: z.number(),
  height: z.number(),
  file_size: z.number().optional(),
})

export const TelegramAudioSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  duration: z.number(),
  file_name: z.string().optional(),
  mime_type: z.string().optional(),
  file_size: z.number().optional(),
})

export const TelegramVideoSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  width: z.number(),
  height: z.number(),
  duration: z.number(),
  file_name: z.string().optional(),
  mime_type: z.string().optional(),
  file_size: z.number().optional(),
})

export const TelegramVoiceSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  duration: z.number(),
  mime_type: z.string().optional(),
  file_size: z.number().optional(),
})

export const TelegramMessageSchema = z.object({
  message_id: z.number(),
  date: z.number(),
  chat: TelegramChatSchema,
  from: TelegramUserSchema.optional(),
  text: z.string().optional(),
  caption: z.string().optional(),
  document: TelegramDocumentSchema.optional(),
  photo: z.array(TelegramPhotoSizeSchema).optional(),
  audio: TelegramAudioSchema.optional(),
  video: TelegramVideoSchema.optional(),
  voice: TelegramVoiceSchema.optional(),
})

export const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: TelegramMessageSchema.optional(),
})

export type TelegramChat = z.infer<typeof TelegramChatSchema>
export type TelegramUser = z.infer<typeof TelegramUserSchema>
export type TelegramMessage = z.infer<typeof TelegramMessageSchema>
export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>
