import { z } from 'zod';

export const colorSchema = z.object({
  name: z.string()
    .min(1, 'Color name is required')
    .max(50, 'Color name is too long')
    .trim(),
});

export const productionEntrySchema = z.object({
  entry_date: z.string().min(1, 'Date is required'),
  color_id: z.string().uuid('Please select a valid color'),
  quantity: z.number({ message: 'Must be a number' })
    .int('Must be an integer')
    .positive('Must be positive')
    .min(1, 'Minimum 1 fall is required'),
});

export const rateSchema = z.object({
  rate_per_dozen: z.number({ message: 'Must be a number' })
    .positive('Must be positive')
    .min(0.01, 'Minimum rate is 0.01'),
  effective_from: z.string().min(1, 'Effective date is required'),
});

export const settingsSchema = z.object({
  appName: z.string().min(1, 'Name is required').max(100),
});
