---
id: tl-appointments-schedule-flow
locale: tl
category: appointments
intents: ["appointment", "schedule", "time slots", "booking"]
relatedRoutes: ["/appointments", "/share-slots"]
toolBindings: ["route_guidance"]
priority: high
lastUpdated: 2026-11-16
quickAnswer: Gamitin ang Appointments para sa agenda, iisang booking form, arrival, at rescheduling.
---
- Agenda ang unang view; mayroon pa ring Calendar view. Ang search ay para sa appointments na naka-load sa napiling scope.
- Sa New appointment, nasa isang form ang customer, available na petsa/oras, at notes. Wala nang magkakahiwalay na Continue screens.
- Bine-validate ang bagong customer contact details. Hintaying ma-load ang availability; gamitin ang Retry kapag may error.
- Nananatili ang inputs sa failed booking. Ginagamit muli ang na-resolve nang customer kapag nag-retry.
- May dati nang details sa Reschedule. May confirmation ang cancellation. Sinisimulan ng Arrived ang automatic visit recording.
- Sa Share slots makikita ang booking link at social assets. Tiyaking tama ang negosyo at schedule bago magbahagi.
