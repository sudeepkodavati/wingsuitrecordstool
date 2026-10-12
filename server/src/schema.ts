import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max).default('');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const contact = z
  .object({
    name: text(200),
    phone: text(50),
    email: text(200),
  })
  .default({});

const judge = z
  .object({
    name: text(200),
    phone: text(50),
    email: text(200),
    // Optional so events saved before roles existed still export.
    role: z.enum(['', 'regional', 'national', 'dz-sta', 'fai']).default(''),
  })
  .default({});

const skydiver = z.object({
  // Needed to match record members; older clients may not send it.
  id: z.string().max(100).default(''),
  jumperNumber: z.number().int().positive(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  nickName: text(100),
  uspaMembershipId: z.string().trim().min(1).max(20),
  membershipExpiration: isoDate,
  uspaLicenseNumber: text(20),
  isVideographer: z.boolean().default(false),
});

/** The event payload the client sends for PDF export. Unknown keys are stripped. */
export const eventSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dropZone: text(200),
  city: text(100),
  state: text(50),
  startDate: isoDate,
  endDate: isoDate,
  aircraft: text(200),
  organizer: contact,
  localJudge: judge,
  remoteJudges: z.array(judge).max(50).default([]),
  notes: text(5000),
  skydivers: z.array(skydiver).max(2000).default([]),
});

export type EventPayload = z.infer<typeof eventSchema>;
export type SkydiverPayload = EventPayload['skydivers'][number];
export type ContactPayload = EventPayload['organizer'];
export type JudgePayload = EventPayload['localJudge'];

const gridPosition = z.object({ row: z.number().int().min(0), col: z.number().int().min(0) });

export const recordPdfSchema = z.object({
  event: eventSchema,
  record: z.object({
    /** "Zone: Type" or "State name: Type", built by the client. */
    title: z.string().trim().min(1).max(300),
    skydiverIds: z.array(z.string().max(100)).max(2000).default([]),
    grid: z.object({
      size: z.number().int().min(1).max(100),
      positions: z.record(gridPosition).default({}),
    }),
    viewpoint: z.enum(['top-down', 'back-to-front']).default('top-down'),
    // Empty for records saved before attempt dates existed.
    attemptDate: z.union([isoDate, z.literal('')]).default(''),
  }),
});

export type RecordPayload = z.infer<typeof recordPdfSchema>['record'];
export type GridPayload = RecordPayload['grid'];
