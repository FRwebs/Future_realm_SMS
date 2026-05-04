# Support Service Portals Audit

Audit date: May 3, 2026  
Scope: Nurse, Librarian, Front Desk, Hostel, Transport

## Summary

The codebase already contained fragments of support-service domain data inside shared operations models, but it did not yet have dedicated role-native portals for these five roles. This pass activated dedicated backend endpoints, role-aware navigation, default landing paths, topbar profile routing, and premium portal workspaces for each role.

## Nurse / Health Officer

### Already present before this pass
- Roles existed: `SCHOOL_NURSE`, `NURSE`
- Generic health visit model existed: `HealthVisit`
- Generic stock model existed: `InventoryItem`
- Medical baseline on student existed through `MedicalRecord`
- Nurses could still access older generic operations areas

### Missing before this pass
- No `/portals/nurse/*` route family
- No `/api/v1/nurse/*` portal-native API
- No nurse-specific sidebar or dashboard
- No health profile workspace
- No inventory command board for nurse role
- No dedicated emergency, screening, or sick-leave schema

### Implemented in this pass
- Dedicated portal routes under `/portals/nurse`
- Dedicated API namespace under `/api/v1/nurse`
- Dashboard, queue, visit history, health profiles, inventory, reports shell
- Role-native profile route

### Still structurally missing
- `student_health_profiles`
- `health_emergencies`
- `health_screenings`
- `screening_records`
- `sick_leave_records`
- medication dispensing transaction model

## Librarian

### Already present before this pass
- Role existed: `LIBRARIAN`
- Book catalog model existed: `LibraryBook`
- Loan model existed: `LibraryLoan`

### Missing before this pass
- No `/portals/librarian/*` route family
- No `/api/v1/library/*` portal-native API
- No issue/return portal workflow pages
- No librarian dashboard
- No member management workspace
- No fine, reservation, settings, or digital-resources schema

### Implemented in this pass
- Dedicated portal routes under `/portals/librarian`
- Dedicated API namespace under `/api/v1/library`
- Dashboard, circulation views, catalog views, member views, report views, settings shell
- Role-native profile route

### Still structurally missing
- `library_members`
- `book_copies`
- `book_reservations`
- `library_fines`
- `library_settings`
- `reading_programs`
- `digital_resources`

## Front Desk / Receptionist

### Already present before this pass
- Role existed: `RECEPTIONIST`
- Visitor model existed: `VisitorLog`
- Parent meeting model existed: `ParentMeeting`

### Missing before this pass
- No `/portals/front-desk/*` route family
- No `/api/v1/front-desk/*` portal-native API
- No receptionist dashboard
- No student movement, parcel, lost-found, room-booking, or call-log schema

### Implemented in this pass
- Dedicated portal routes under `/portals/front-desk`
- Dedicated API namespace under `/api/v1/front-desk`
- Dashboard, visitor views, reception meeting views, reporting shell
- Live desk clock on dashboard
- Role-native profile route

### Still structurally missing
- `student_movements`
- `lost_found_items`
- `parcels_mail`
- `meeting_rooms`
- `room_bookings`
- `call_logs`
- `front_desk_notices`

## Hostel / Boarding

### Already present before this pass
- Roles existed: `HOSTEL_MANAGER`, `HOSTEL_MASTER`, `HOSTEL_MATRON`, `HOSTEL_MISTRESS`
- Building model existed: `HostelBuilding`
- Room model existed: `HostelRoom`
- Allocation model existed: `HostelAllocation`

### Missing before this pass
- No `/portals/hostel/*` route family
- No `/api/v1/hostel/*` portal-native API
- No boarding dashboard
- No bed-map UX
- No roll-call, exeat, hostel incident, maintenance, inventory, or schedule schema

### Implemented in this pass
- Dedicated portal routes under `/portals/hostel`
- Dedicated API namespace under `/api/v1/hostel`
- Dashboard, boarder roster, room and bed map, reporting shell
- Role-native profile route

### Still structurally missing
- `hostel_beds`
- `hostel_attendance_sessions`
- `hostel_attendance_records`
- `exeat_requests`
- `hostel_incidents`
- `hostel_maintenance_requests`
- `hostel_inventory`
- `hostel_schedules`

## Transport

### Already present before this pass
- Roles existed: `TRANSPORT_COORDINATOR`, `TRANSPORT_MANAGER`
- Vehicle model existed: `TransportVehicle`
- Route model existed: `TransportRoute`
- Student assignment model existed: `TransportAssignment`

### Missing before this pass
- No `/portals/transport/*` route family
- No `/api/v1/transport/*` portal-native API
- No transport dashboard
- No route-first portal workspace
- No driver, compliance, incident, fuel, maintenance, or attendance schema

### Implemented in this pass
- Dedicated portal routes under `/portals/transport`
- Dedicated API namespace under `/api/v1/transport`
- Dashboard, vehicles, routes, assignments, compliance shell, reports shell
- Role-native profile route

### Still structurally missing
- `drivers`
- `route_stops`
- `transport_attendance_sessions`
- `transport_attendance_records`
- `vehicle_maintenance_logs`
- `fuel_logs`
- `transport_incidents`
- compliance document storage / expiry model

## Files Activated In This Pass

- `backend/src/modules/support-portals/support-portals.controller.ts`
- `backend/src/modules/support-portals/support-portals.module.ts`
- `backend/src/modules/support-portals/support-portals.service.ts`
- `src/lib/support-services/portal.ts`
- `src/components/portals/support-portal-ui.tsx`
- `src/components/portals/support-portal-workspaces.tsx`
- `src/components/portals/front-desk-live-clock.tsx`
- `src/lib/navigation/registry.ts`
- `src/lib/auth/roles.ts`
- `src/components/layout/topbar.tsx`
- `src/app/(app)/portals/nurse/*`
- `src/app/(app)/portals/librarian/*`
- `src/app/(app)/portals/front-desk/*`
- `src/app/(app)/portals/hostel/*`
- `src/app/(app)/portals/transport/*`

## Verification

- `npm run build:web`
- `npm run build:api`
- `npx vitest run tests/unit/navigation.test.ts tests/unit/permissions.test.ts`
