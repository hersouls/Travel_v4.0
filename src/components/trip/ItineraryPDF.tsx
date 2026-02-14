import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { Trip, Plan, PlanType } from '@/types'
import { PLAN_TYPE_LABELS } from '@/utils/constants'

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  // Title page
  titlePage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleLabel: {
    fontSize: 12,
    color: '#0ea5e9',
    letterSpacing: 2,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  titleText: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#0ea5e9',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleCountry: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 6,
  },
  titleDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  titleDivider: {
    width: 60,
    height: 2,
    backgroundColor: '#0ea5e9',
    marginVertical: 16,
  },
  // Day header
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  dayBadge: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
  },
  dayBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  dayDateText: {
    fontSize: 10,
    color: '#64748b',
  },
  // Plan item
  planItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  planTime: {
    width: 55,
    paddingRight: 8,
  },
  planTimeText: {
    fontSize: 9,
    color: '#0ea5e9',
    fontFamily: 'Helvetica-Bold',
  },
  planEndTimeText: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 1,
  },
  planContent: {
    flex: 1,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  planName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    marginRight: 6,
  },
  typeBadge: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: '#bae6fd',
  },
  typeBadgeText: {
    fontSize: 7,
    color: '#0284c7',
  },
  planAddress: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 2,
  },
  planMemo: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 1.4,
  },
  // Empty day
  emptyDay: {
    padding: 12,
    alignItems: 'center',
  },
  emptyDayText: {
    fontSize: 9,
    color: '#94a3b8',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#94a3b8',
  },
  pageNumber: {
    fontSize: 7,
    color: '#94a3b8',
  },
  // Section divider
  sectionDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
})

function getTypeLabel(type: PlanType): string {
  return PLAN_TYPE_LABELS[type] || type
}

function formatDateForPDF(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${year}. ${parseInt(month)}. ${parseInt(day)}.`
}

function getDayDate(startDate: string, dayNumber: number): string {
  const [year, month, day] = startDate.split('-').map(Number)
  const date = new Date(year, month - 1, day + (dayNumber - 1))
  const m = date.getMonth() + 1
  const d = date.getDate()
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const weekday = weekdays[date.getDay()]
  return `${m}월 ${d}일 (${weekday})`
}

function getTripDurationDays(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

interface ItineraryPDFProps {
  trip: Trip
  plans: Plan[]
  plansByDay: Record<number, Plan[]>
}

export function ItineraryPDF({ trip, plans, plansByDay }: ItineraryPDFProps) {
  const totalDays = getTripDurationDays(trip.startDate, trip.endDate)
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)

  return (
    <Document>
      {/* Title Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.titlePage}>
          <Text style={styles.titleLabel}>TRAVEL ITINERARY</Text>
          <Text style={styles.titleText}>{trip.title}</Text>
          <View style={styles.titleDivider} />
          <Text style={styles.titleCountry}>{trip.country}</Text>
          <Text style={styles.titleDate}>
            {formatDateForPDF(trip.startDate)} - {formatDateForPDF(trip.endDate)}
          </Text>
          <Text style={[styles.titleDate, { marginTop: 4 }]}>
            {totalDays}일 / {plans.length}개 일정
          </Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>Moonwave Travel</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>

      {/* Itinerary Pages */}
      <Page size="A4" style={styles.page} wrap>
        {days.map((day) => {
          const dayPlans = plansByDay[day] || []
          return (
            <View key={day} wrap={false} style={{ marginBottom: 16 }}>
              {/* Day Header */}
              <View style={styles.dayHeader}>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>Day {day}</Text>
                </View>
                <Text style={styles.dayDateText}>
                  {getDayDate(trip.startDate, day)}
                </Text>
              </View>

              {/* Plans */}
              {dayPlans.length === 0 ? (
                <View style={styles.emptyDay}>
                  <Text style={styles.emptyDayText}>일정이 없습니다</Text>
                </View>
              ) : (
                dayPlans.map((plan, idx) => (
                  <View key={plan.id ?? idx} style={styles.planItem} wrap={false}>
                    <View style={styles.planTime}>
                      <Text style={styles.planTimeText}>{plan.startTime}</Text>
                      {plan.endTime && (
                        <Text style={styles.planEndTimeText}>~ {plan.endTime}</Text>
                      )}
                    </View>
                    <View style={styles.planContent}>
                      <View style={styles.planNameRow}>
                        <Text style={styles.planName}>{plan.placeName}</Text>
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>
                            {getTypeLabel(plan.type)}
                          </Text>
                        </View>
                      </View>
                      {plan.address && (
                        <Text style={styles.planAddress}>{plan.address}</Text>
                      )}
                      {plan.memo && (
                        <Text style={styles.planMemo}>
                          {plan.memo.length > 200
                            ? `${plan.memo.slice(0, 200)}...`
                            : plan.memo}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}

              {/* Section divider between days */}
              {day < totalDays && <View style={styles.sectionDivider} />}
            </View>
          )
        })}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Moonwave Travel</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
