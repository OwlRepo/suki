---
id: en-appointments-schedule-flow
locale: en
category: appointments
intents: ["appointment", "schedule", "time slots", "booking"]
relatedRoutes: ["/appointments", "/share-slots"]
toolBindings: ["route_guidance"]
priority: high
lastUpdated: 2026-11-16
quickAnswer: Open Appointments for an agenda, one-screen booking, arrival, and rescheduling.
---
- Agenda is the default; Calendar view remains available. Customer search filters loaded appointments for the selected scope.
- New appointment opens one form with existing/new customer, available day/time, and notes. No intermediate Continue screens are required.
- New-customer contact information is validated. Availability is loaded from the existing booking service; retry failed loading before choosing a slot.
- A booking failure retains entered information. A resolved customer is reused when retrying, rather than resolving a second customer.
- Reschedule retains appointment details. Cancellation requires confirmation. Arrived starts automatic visit recording; staff bookings retain their existing OTP/PIN rules.
- /appointments?new=1 opens booking directly. A direct reschedule link identifies only a loaded appointment from the active business.
- Share slots provides booking links and generated social assets. Confirm the business and schedule before sharing.
