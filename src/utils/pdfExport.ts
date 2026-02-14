import { pdf, DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { createElement } from 'react'
import { ItineraryPDF } from '@/components/trip/ItineraryPDF'
import type { Trip, Plan } from '@/types'

/**
 * Generate and download a PDF itinerary for a trip.
 */
export async function downloadItineraryPDF(trip: Trip, plans: Plan[]): Promise<void> {
  // Group plans by day, sorted by startTime
  const plansByDay: Record<number, Plan[]> = {}
  for (const plan of plans) {
    if (!plansByDay[plan.day]) plansByDay[plan.day] = []
    plansByDay[plan.day].push(plan)
  }
  for (const day of Object.keys(plansByDay)) {
    plansByDay[parseInt(day)].sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  // ItineraryPDF returns a <Document> as its root, so the resulting element
  // is compatible with pdf() at runtime. The cast bridges the TS mismatch
  // between the component's own props and DocumentProps.
  const element = createElement(ItineraryPDF, {
    trip,
    plans,
    plansByDay,
  }) as unknown as ReactElement<DocumentProps>

  // Generate the PDF blob
  const blob = await pdf(element).toBlob()

  // Create a sanitized filename
  const safeName = trip.title.replace(/[^a-zA-Z0-9가-힣\s-_]/g, '').trim() || 'itinerary'
  const fileName = `${safeName}-itinerary.pdf`

  // Trigger browser download
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
