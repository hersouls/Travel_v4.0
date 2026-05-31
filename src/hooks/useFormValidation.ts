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

  // 검증 결과(에러 맵)를 동기적으로 반환한다. null이면 통과.
  // setErrors는 비동기이므로 호출부가 errors 상태 대신 이 반환값을 읽어야 stale closure를 피한다.
  const validate = useCallback(
    (data: unknown): ValidationErrors | null => {
      try {
        schema.parse(data)
        setErrors({})
        return null
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
        return fieldErrors
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
