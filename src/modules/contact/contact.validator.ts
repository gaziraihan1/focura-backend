import { z } from 'zod';

export const ContactCategory = z.enum([
  'GENERAL',
  'BILLING',
  'TECHNICAL',
  'FEATURE_REQUEST',
  'PARTNERSHIP',
  'SECURITY',
  'OTHER',
]);

export type ContactCategoryType = z.infer<typeof ContactCategory>;

export const createContactMessageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2,   'Name must be at least 2 characters')
    .max(100, 'Name must be under 100 characters'),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address')
    .max(255, 'Email must be under 255 characters'),

  subject: z
    .string()
    .trim()
    .min(5,   'Subject must be at least 5 characters')
    .max(200, 'Subject must be under 200 characters'),

  category: ContactCategory,

  message: z
    .string()
    .trim()
    .min(20,   'Message must be at least 20 characters')
    .max(5000, 'Message must be under 5000 characters'),
});

export type CreateContactMessageInput = z.infer<typeof createContactMessageSchema>;