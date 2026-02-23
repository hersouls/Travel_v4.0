// ============================================
// Expense Store (Zustand)
// ============================================

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Expense } from '@/types'
import * as db from '@/services/database'
import { sendBroadcast } from '@/services/broadcast'
import { syncManager } from '@/services/firestoreSync'
import { useUIStore } from '@/stores/uiStore'

const UNDO_TIMEOUT_MS = 30_000

interface ExpenseState {
  // State
  expenses: Expense[]
  isLoading: boolean
  error: string | null

  // Actions
  loadExpenses: (tripId: number) => Promise<void>
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<number>
  updateExpense: (id: number, updates: Partial<Expense>) => Promise<void>
  deleteExpense: (id: number) => Promise<void>
  importFromTravelLogs: (tripId: number) => Promise<number>
  clearExpenses: () => void
  setError: (error: string | null) => void
}

export const useExpenseStore = create<ExpenseState>()(
  devtools(
    (set) => ({
      // Initial State
      expenses: [],
      isLoading: false,
      error: null,

      // Load all expenses for a trip
      loadExpenses: async (tripId) => {
        set({ isLoading: true, error: null })
        try {
          const expenses = await db.getExpensesForTrip(tripId)
          set({ expenses, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Add a new expense
      addExpense: async (expenseData) => {
        try {
          const expense: Omit<Expense, 'id'> = {
            ...expenseData,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          const id = await db.addExpense(expense)

          // Sync to Firestore
          if (syncManager.isActive()) {
            const savedExpense = await db.getExpense(id)
            if (savedExpense) {
              try {
                const firebaseId = await syncManager.uploadExpense(savedExpense)
                if (firebaseId) {
                  await db.updateExpense(id, { firebaseId })
                }
              } catch (e) {
                console.error('[ExpenseStore] Sync failed:', e)
                useUIStore.getState().showToast({
                  type: 'warning',
                  title: '클라우드 동기화 실패',
                  message: '경비가 로컬에 저장되었으나 동기화되지 않았습니다',
                  duration: 5000,
                })
              }
            }
          }

          // Partial update: append + sort by timestamp
          const newExpense = await db.getExpense(id)
          if (newExpense) {
            set(state => {
              const updated = [...state.expenses, newExpense]
              updated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              return { expenses: updated }
            })
          }
          sendBroadcast('EXPENSE_CREATED', { id, tripId: expenseData.tripId })
          return id
        } catch (error) {
          set({ error: (error as Error).message })
          throw error
        }
      },

      // Update an expense
      updateExpense: async (id, updates) => {
        try {
          await db.updateExpense(id, updates)

          const expense = await db.getExpense(id)
          if (expense) {
            // Sync
            if (syncManager.isActive()) {
              try {
                const firebaseId = await syncManager.uploadExpense(expense)
                if (firebaseId && firebaseId !== expense.firebaseId) {
                  await db.updateExpense(id, { firebaseId })
                }
              } catch (e) {
                console.error('[ExpenseStore] Sync update failed:', e)
                useUIStore.getState().showToast({
                  type: 'warning',
                  title: '클라우드 동기화 실패',
                  message: '경비 수정이 로컬에만 반영되었습니다',
                  duration: 5000,
                })
              }
            }

            // Partial update: replace in-place
            set(state => ({
              expenses: state.expenses.map(e => e.id === id ? expense : e),
            }))
            sendBroadcast('EXPENSE_UPDATED', { id, tripId: expense.tripId })
          }
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      // Delete an expense with 30s undo
      deleteExpense: async (id) => {
        try {
          const snapshot = await db.getExpense(id)
          if (!snapshot) return

          const tripId = snapshot.tripId
          const firebaseId = snapshot.firebaseId

          // Mark as pending delete
          if (firebaseId) syncManager.addPendingDelete(firebaseId)

          // Delete locally
          await db.deleteExpense(id)

          // Partial update: filter out
          set(state => ({ expenses: state.expenses.filter(e => e.id !== id) }))
          sendBroadcast('EXPENSE_DELETED', { id, tripId })

          // Deferred remote delete with undo
          let undone = false
          const timer = setTimeout(async () => {
            if (undone) return
            if (syncManager.isActive() && firebaseId) {
              try {
                await syncManager.deleteRemoteExpense(firebaseId)
              } catch (e) {
                console.error('[ExpenseStore] Remote delete failed:', e)
              }
            }
            if (firebaseId) syncManager.removePendingDelete(firebaseId)
          }, UNDO_TIMEOUT_MS)

          useUIStore.getState().showToast({
            type: 'warning',
            title: '경비가 삭제되었습니다',
            message: '30초 이내에 되돌릴 수 있습니다',
            duration: UNDO_TIMEOUT_MS,
            action: {
              label: '되돌리기',
              onClick: async () => {
                undone = true
                clearTimeout(timer)
                if (firebaseId) syncManager.removePendingDelete(firebaseId)
                // Restore from snapshot with new ID
                const { id: _id, ...rest } = snapshot
                const newId = await db.addExpense(rest as Omit<Expense, 'id'>)
                const restored = await db.getExpense(newId)
                if (restored) {
                  set(state => {
                    const updated = [...state.expenses, restored]
                    updated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    return { expenses: updated }
                  })
                }
                useUIStore.getState().showToast({
                  type: 'success',
                  title: '경비가 복원되었습니다',
                })
              },
            },
          })
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      // Import expenses from TravelLog records that have expense data
      importFromTravelLogs: async (tripId) => {
        try {
          const logs = await db.getTravelLogsForTrip(tripId)
          let importedCount = 0

          for (const log of logs) {
            if (!log.expense || !log.id) continue

            // Check if already imported (sourceLogId dedup)
            const existingById = await db.getExpenseBySourceLogId(log.id)
            if (existingById) continue

            // Cross-device dedup via sourceLogFirebaseId
            if (log.firebaseId) {
              const existingByFbId = await db.getExpenseBySourceLogFirebaseId(log.firebaseId)
              if (existingByFbId) continue
            }

            const expense: Omit<Expense, 'id'> = {
              tripId: log.tripId,
              tripFirebaseId: log.tripFirebaseId,
              day: log.day,
              timestamp: log.timestamp,
              category: log.expense.category,
              storeName: log.expense.storeName,
              items: log.expense.items,
              totalAmount: log.expense.totalAmount,
              currency: log.expense.currency,
              receiptDate: log.expense.receiptDate,
              sourceLogId: log.id,
              sourceLogFirebaseId: log.firebaseId,
              latitude: log.latitude,
              longitude: log.longitude,
              address: log.address,
              createdAt: new Date(),
              updatedAt: new Date(),
            }

            const id = await db.addExpense(expense)

            // Sync to Firestore
            if (syncManager.isActive()) {
              const saved = await db.getExpense(id)
              if (saved) {
                try {
                  const fbId = await syncManager.uploadExpense(saved)
                  if (fbId) await db.updateExpense(id, { firebaseId: fbId })
                } catch (e) {
                  console.error('[ExpenseStore] Import sync failed:', e)
                  useUIStore.getState().showToast({
                    type: 'warning',
                    title: '클라우드 동기화 실패',
                    message: '경비가 로컬에 저장되었으나 동기화되지 않았습니다',
                    duration: 5000,
                  })
                }
              }
            }

            importedCount++
          }

          // Reload all expenses after import
          if (importedCount > 0) {
            const expenses = await db.getExpensesForTrip(tripId)
            set({ expenses })
          }

          return importedCount
        } catch (error) {
          set({ error: (error as Error).message })
          throw error
        }
      },

      // Clear expenses (when navigating away)
      clearExpenses: () => set({ expenses: [], error: null }),

      // Set error
      setError: (error) => set({ error }),
    }),
    { name: 'expense-store' },
  ),
)

// Selector hooks
export const useExpenses = () => useExpenseStore((state) => state.expenses)
export const useExpenseLoading = () => useExpenseStore((state) => state.isLoading)
