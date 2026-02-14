// ============================================
// Form Validation Hook (generic, zod-based)
// ============================================

import { useState, useCallback } from 'react'
import type { ZodSchema, ZodError } from 'zod'

export interface ValidationErrors {
  [field: string]: string | undefined
}

export function useFormValidation<T>(schema: ZodSchema<T>) {
  const [errors, setErrors] = useState<ValidationErrors>({})

  const validate = useCallback(
    (data: unknown): data is T => {
      try {
        schema.parse(data)
        setErrors({})
        return true
      } catch (err) {
        const zodError = err as ZodError
        const fieldErrors: ValidationErrors = {}
        for (const issue of zodError.issues) {
          const field = issue.path.join('.')
          if (!fieldErrors[field]) {
            fieldErrors[field] = issue.message
          }
        }
        setErrors(fieldErrors)
        return false
      }
    },
    [schema]
  )

  const validateField = useCallback(
    (field: string, value: unknown, fullData: unknown) => {
      try {
        schema.parse(fullData)
        setErrors((prev) => {
          const next = { ...prev }
          delete next[field]
          return next
        })
      } catch (err) {
        const zodError = err as ZodError
        const fieldIssue = zodError.issues.find((i) => i.path.join('.') === field)
        setErrors((prev) => ({
          ...prev,
          [field]: fieldIssue?.message,
        }))
      }
    },
    [schema]
  )

  const clearErrors = useCallback(() => setErrors({}), [])

  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  return { errors, validate, validateField, clearErrors, clearFieldError }
}
