# Roadmap Module Implementation Status

## Overview
Implementation of the "Feuille de route + Calendrier + Rappels" module with Telegram integration.

## Current Status: FOUNDATION COMPLETE ✅

### ✅ Completed Components

#### 1. Database Schema & Migration
**File**: `supabase/migrations/20251111180000_roadmap_system.sql`
- ✅ All 7 tables created with proper schema
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Secure view `user_telegram_bots_public` (hides sensitive tokens)
- ✅ Indexes optimized for common queries
- ✅ Triggers for `updated_at` timestamps

**Tables**:
- `user_settings_roadmap` - User preferences (reminder days, EOD hour, Telegram config)
- `roadmap_templates` - Weekly recurring tasks (e.g., "Monday 9am meeting")
- `roadmap_entries` - Actual task entries for specific dates
- `events` - Calendar events with recurrence support
- `event_reminders` - Reminder configurations for events
- `roadmap_notifications` - Generated notifications (in-app + Telegram)
- `user_telegram_bots` - Personal Telegram bot configurations (secure)

#### 2. TypeScript Types
**File**: `src/types/roadmap.ts`
- ✅ Complete type definitions for all entities
- ✅ Form data types for creation/editing
- ✅ API response types
- ✅ Telegram configuration types

#### 3. API Client Functions
**File**: `src/lib/roadmapApi.ts`
- ✅ `fetchRoadmapWeek()` - Get week data with merged templates + entries
- ✅ `saveEntries()` - Batch save/update entries
- ✅ `createOrUpdateTemplateItem()` - Manage recurring templates
- ✅ `createEvent()`, `updateEvent()`, `deleteEvent()` - Event management
- ✅ `fetchMonth()` - Calendar data with density
- ✅ `fetchNotifications()`, `markAsSeen()`, `markAsDone()` - Notification management
- ✅ `getSettings()`, `saveSettings()` - User preferences
- ✅ `testTelegram()`, `getTelegramConnectionInfo()` - Telegram testing
- ✅ `setupPersonalTelegramBot()`, `testPersonalTelegramBot()`, `revokePersonalTelegramBot()` - Personal bot management
- ✅ `switchTelegramMode()` - Toggle shared/personal mode

#### 4. Netlify Serverless Functions (Partial)
**Files**:
- ✅ `netlify/functions/roadmap-week.ts` - GET/POST week data (merged templates + entries)
- ✅ `netlify/functions/roadmap-month.ts` - GET month calendar data with density
- ✅ `netlify/functions/roadmap-notifications.ts` - GET unread notifications, POST mark seen/done

#### 5. Dependencies
- ✅ `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` already installed

---

## 🚧 Remaining Implementation (Priority Order)

### PRIORITY 1: Core Serverless Functions

#### Telegram Integration Functions
**Location**: `netlify/functions/`

1. **telegram-shared-webhook.ts** - Webhook for shared bot
   - Verify `X-Telegram-Bot-Api-Secret-Token` header
   - Handle `/start {user_id}` to save `telegram_chat_id`
   - Handle `/stop` to disable Telegram

2. **telegram-personal-setup.ts** - Setup personal bot
   - Upsert `user_telegram_bots` table
   - Call Telegram `setWebhook` API
   - Generate webhook secret

3. **telegram-personal-webhook.ts** - Webhook for personal bots
   - Verify secret per user
   - Handle `/start` and `/stop`

4. **telegram-personal-test.ts** - Test personal bot
   - Send test message using user's bot token

5. **telegram-personal-revoke.ts** - Revoke personal bot
   - Call Telegram `deleteWebhook`
   - Update status to 'revoked'

6. **telegram-mode.ts** - Switch Telegram mode
   - Update `telegram_mode` in `user_settings_roadmap`

7. **telegram-info.ts** - Get connection info
   - Return shared bot URL and personal bot URL
   - Check connection status

8. **telegram-test.ts** - Test Telegram (shared or personal)
   - Route based on current mode
   - Send test message

#### Template & Event Management Functions
**Location**: `netlify/functions/`

9. **roadmap-template.ts** - Create/update/delete templates
   - POST: Create or update template
   - DELETE: Delete template
   - Support "propagate to future weeks" option

10. **roadmap-event.ts** - Create/update/delete events
    - POST: Create event with reminders
    - PUT: Update event
    - DELETE: Delete event

#### Scheduled Notification Processing
**Location**: `netlify/functions/`

11. **roadmap-process-notifications.ts** (CRON: every hour)
    - For each user, convert their `eod_hour` to current UTC time considering Europe/Paris timezone
    - Check if reminders should be generated (based on `default_reminder_days` and scheduled events)
    - Check if EOD summary should be generated
    - Create `roadmap_notifications` entries (in-app)
    - Send Telegram messages if enabled (non-blocking)

### PRIORITY 2: Frontend Components

#### Dashboard Widget
**Location**: `src/components/roadmap/`

12. **RoadmapWidget.tsx** - Dashboard widget
    - Header with title, KPI pills (Total/Done/Remaining), primary button
    - 3 tabs: Jour/Semaine/Mois
    - Vue Jour: horizontal mini-kanban with checkboxes
    - Vue Semaine: heatmap + 3 next tasks per day
    - Vue Mois: mini-calendar with density dots + tooltips
    - Link to "Voir tous les rappels"
    - Responsive mobile-first

13. **Integration in Dashboard** (`src/App.tsx`)
    - Insert `<RoadmapWidget />` at top of dashboard section

#### Main Roadmap Page
**Location**: `src/pages/` and `src/components/roadmap/`

14. **Roadmap.tsx** - Main page
    - Header with title + subtitle
    - Toggle between Kanban and Calendar views
    - Week selector synchronized with URL

15. **RoadmapToolbar.tsx** - Toolbar component
    - View toggle (Kanban/Calendar)
    - "Ajouter" button
    - Options menu
    - Notifications bell with badge

16. **RoadmapKanban.tsx** - Kanban view with drag & drop
    - 5 columns (Lundi-Vendredi)
    - @dnd-kit for vertical + horizontal drag & drop
    - Cards: checkbox, time, title, badge (Hebdo/Ponctuel), status switch, context menu
    - Column headers: "Tout vu" / "Tout fait" actions
    - Filter panel (status, type, search)

17. **RoadmapCalendar.tsx** - Calendar view
    - Month grid with navigation
    - Display events + entry density
    - Click day to create
    - Hover tooltips with first 3 tasks

18. **RoadmapItemForm.tsx** - Modal for create/edit
    - Fields: title, description, date/day_of_week, times, type (hebdo/ponctuel)
    - Recurrence options
    - "Propager aux semaines futures" checkbox
    - Reminder checkboxes (J-1/J-2/J-3)

19. **RoadmapNotificationsBell.tsx** - Notifications bell + drawer
    - Bell icon with badge count
    - Drawer with 2 sections: Rappels + Bilan du jour
    - Actions: "Marquer vu", "Marquer fait"
    - Links to associated entries
    - Callout "Connecter Telegram" if not paired

### PRIORITY 3: Settings Integration

#### Telegram Configuration UI
**Location**: `src/pages/settings/` or add section in existing Settings

20. **RoadmapSettings.tsx** - Settings page section
    - **Rappels par défaut**: Multi-select J-1/J-2/J-3, EOD hour input
    - **Bot partagé (simple)**:
      - Connection status
      - Button "Connecter Telegram" → opens `t.me/BOT_USERNAME?start={user_id}`
      - Toggle "Activer Telegram"
      - Button "Envoyer un test"
    - **Mon bot personnel (avancé)** - 4-step wizard:
      - Step 1: Input bot_username + bot_token, button "Configurer webhook"
      - Step 2: "Lier mon chat" button + real-time status (pending/active)
      - Step 3: Toggle "Utiliser mon bot" (telegram_mode='personal')
      - Step 4: Test + Revoke buttons
    - Security warning about token

### PRIORITY 4: Navigation & Routing

21. **App.tsx Updates**
    - Add "Feuille de route" to sidebar (above "Agenda")
    - Add `case 'roadmap'` in `renderContent()`
    - Add `/roadmap` mapping in `mapPathToPage()`
    - Add `'roadmap'` to `ALLOWED` whitelist

### PRIORITY 5: Configuration

22. **netlify.toml Update**
    - Add CRON schedule for `roadmap-process-notifications` (every hour)

23. **Environment Variables Documentation**
    - `TELEGRAM_BOT_TOKEN` - Shared bot token
    - `TELEGRAM_BOT_USERNAME` - Shared bot username
    - `TELEGRAM_WEBHOOK_SECRET` - Shared bot webhook secret
    - `PUBLIC_URL` - Base URL for webhooks
    - Existing: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

24. **BotFather Documentation**
    - Create README section with step-by-step bot creation
    - Webhook setup instructions
    - Security best practices

---

## Technical Architecture

### Timezone Handling (Europe/Paris)
- CRON runs every hour in UTC
- Server-side conversion to Europe/Paris timezone for each user
- User settings store `eod_hour` as local time (0-23)
- Properly handles DST transitions

### Drag & Drop (@dnd-kit)
- Vertical: Reorder tasks within a day
- Horizontal: Move tasks between days (Mon-Fri)
- Touch-friendly and accessible
- Batch save on drop complete

### Security
- All RLS policies enforce `user_id = auth.uid()`
- Personal bot tokens NEVER exposed to client
- Webhook secrets verified for all Telegram webhooks
- Service role used only in serverless functions

### Notifications Flow
1. **CRON (hourly)**: `roadmap-process-notifications` checks all users
2. **Per user**: Calculate local time, check if reminders/summary due
3. **Generate**: Create `roadmap_notifications` entries (in-app)
4. **Send**: Non-blocking Telegram send (shared or personal based on mode)
5. **UI**: Bell badge updates, drawer shows unread notifications

---

## Testing Checklist

### Phase 1: Database & API
- [ ] Run migration successfully
- [ ] Verify RLS policies block unauthorized access
- [ ] Test API client functions with real data
- [ ] Verify serverless functions return correct data

### Phase 2: Telegram Integration
- [ ] Create shared bot via BotFather
- [ ] Test shared bot webhook with `/start` and `/stop`
- [ ] Setup personal bot and verify webhook
- [ ] Test mode switching (shared ↔ personal)
- [ ] Verify tokens never exposed to client

### Phase 3: UI Components
- [ ] Dashboard widget displays correctly with 3 tabs functional
- [ ] Kanban drag & drop works (vertical + horizontal)
- [ ] Calendar navigation and density display
- [ ] Form modal creates/edits tasks correctly
- [ ] Notifications bell shows badge and drawer opens

### Phase 4: End-to-End
- [ ] Create hebdo template, verify it appears in future weeks
- [ ] Modify template with "propagate", verify future weeks update
- [ ] Mark tasks as vu/fait, verify status persists
- [ ] Notifications generated at correct times (simulate)
- [ ] Telegram messages sent successfully
- [ ] No regressions in existing pages (Atelier, Agenda, Dashboard)

---

## Estimated Remaining Work

- **Serverless Functions**: 10 functions × 30 min = ~5 hours
- **Frontend Components**: 8 components × 45 min = ~6 hours
- **Integration & Routing**: ~1 hour
- **Testing & Debugging**: ~3 hours
- **Documentation**: ~1 hour

**Total**: ~16 hours of development time

---

## Next Steps

1. Complete remaining serverless functions (Telegram integration + template/event management)
2. Implement CRON notification processor with timezone handling
3. Build frontend components (widget → page → settings)
4. Integrate routing and navigation
5. Update netlify.toml with CRON schedule
6. Test thoroughly with real Telegram bot
7. Document BotFather setup process
8. Build and deploy

---

## Notes

- Project uses existing styling patterns (Tailwind CSS)
- No purple/indigo colors per project guidelines
- All components fully responsive (mobile-first)
- Console.log statements added for debugging
- No automatic file splitting unless explicitly requested
- Maintains existing component structure and conventions
