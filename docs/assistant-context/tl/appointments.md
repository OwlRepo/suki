---
id: tl-appointments-schedule-flow
locale: tl
category: appointments
intents: ["appointment", "schedule", "time slots", "booking"]
relatedRoutes: ["/appointments", "/share-slots"]
toolBindings: ["route_guidance"]
priority: high
lastUpdated: 2026-05-10
quickAnswer: Gamitin ang Appointments para sa schedule at Share Slots para sa booking link.
---
- Buksan ang Appointments para gumawa at mag-manage ng schedule.
- I-set muna ang available time slots bago mag-share ng booking link.
- I-check ang service duration at slot spacing para maiwasan ang overlap.
- Tingnan muna ang existing bookings bago magbukas ng bagong schedule windows.
- Kung external ang booking ng customers, i-sync muna ang latest slot setup.
- Buksan ang Share Slots para gumawa ng QR/link para sa self-booking ng customers.
- I-share lang ang link kapag tama na ang business scope at date range.
- Karaniwang mali: nag-share agad ng link kahit hindi pa final ang slots.
- Recovery: ayusin ang slots sa Appointments, tapos i-share ulit ang tamang link.
- Karaniwang mali: maling petsa dahil sa month navigation.
- Recovery: i-verify ang month header at selected day bago mag-save.
