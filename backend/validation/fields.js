import { z } from 'zod'

// Building blocks shared by the request schemas.
export const email = z.string().trim().email().transform((value) => value.toLowerCase())
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID')
export const position = z.number().int().min(0)
