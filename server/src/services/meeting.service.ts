import { db } from '../config/database.js';
import { meetings, meetingAttendees, meetingDecisions, buildings, profiles } from '../db/schema/index.js';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

export async function listMeetings(filters?: { buildingId?: string; allowedBuildingIds?: string[] }) {
  const conditions: any[] = [];
  if (filters?.buildingId) conditions.push(eq(meetings.buildingId, filters.buildingId));
  if (filters?.allowedBuildingIds?.length) {
    conditions.push(inArray(meetings.buildingId, filters.allowedBuildingIds));
  }

  return db
    .select({
      meeting: meetings,
      buildingName: buildings.name,
      attendeeCount: sql<number>`(SELECT count(*) FROM meeting_attendees WHERE meeting_id = ${meetings.id})::int`,
      decisionCount: sql<number>`(SELECT count(*) FROM meeting_decisions WHERE meeting_id = ${meetings.id})::int`,
    })
    .from(meetings)
    .innerJoin(buildings, eq(meetings.buildingId, buildings.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(meetings.date));
}

export async function getMeeting(id: string) {
  const [meeting] = await db
    .select({
      meeting: meetings,
      buildingName: buildings.name,
    })
    .from(meetings)
    .innerJoin(buildings, eq(meetings.buildingId, buildings.id))
    .where(eq(meetings.id, id))
    .limit(1);

  if (!meeting) throw new AppError(404, 'Meeting not found');

  const attendees = await db
    .select({
      attendee: meetingAttendees,
      userName: profiles.name,
    })
    .from(meetingAttendees)
    .leftJoin(profiles, eq(meetingAttendees.userId, profiles.id))
    .where(eq(meetingAttendees.meetingId, id));

  const decisions = await db
    .select({
      decision: meetingDecisions,
      assigneeName: profiles.name,
    })
    .from(meetingDecisions)
    .leftJoin(profiles, eq(meetingDecisions.assignedTo, profiles.id))
    .where(eq(meetingDecisions.meetingId, id))
    .orderBy(meetingDecisions.createdAt);

  return {
    ...meeting.meeting,
    buildingName: meeting.buildingName,
    attendees: attendees.map(a => ({
      ...a.attendee,
      userName: a.userName,
    })),
    decisions: decisions.map(d => ({
      ...d.decision,
      assigneeName: d.assigneeName,
    })),
  };
}

export async function createMeeting(data: {
  buildingId: string;
  title: string;
  date: string;
  location?: string;
  notes?: string;
  attendees?: { userId: string; attended?: boolean }[];
  decisions?: { description: string; assignedTo?: string; dueDate?: string; status?: string }[];
}, userId: string) {
  return await db.transaction(async (tx) => {
    const [meeting] = await tx
      .insert(meetings)
      .values({
        buildingId: data.buildingId,
        title: data.title,
        date: data.date,
        location: data.location || null,
        notes: data.notes || null,
        createdBy: userId,
      })
      .returning();

    if (data.attendees?.length) {
      await tx.insert(meetingAttendees).values(
        data.attendees.map(a => ({
          meetingId: meeting.id,
          userId: a.userId,
          attended: a.attended ?? false,
        })),
      );
    }

    if (data.decisions?.length) {
      await tx.insert(meetingDecisions).values(
        data.decisions.map(d => ({
          meetingId: meeting.id,
          description: d.description,
          assignedTo: d.assignedTo || null,
          dueDate: d.dueDate || null,
          status: (d.status as any) || 'pending',
        })),
      );
    }

    return meeting;
  });
}

export async function updateMeeting(id: string, data: {
  title?: string;
  date?: string;
  location?: string;
  notes?: string;
  attendees?: { userId: string; attended?: boolean }[];
  decisions?: { id?: string; description: string; assignedTo?: string; dueDate?: string; status?: string }[];
}) {
  return await db.transaction(async (tx) => {
    const updateData: any = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const [meeting] = await tx
      .update(meetings)
      .set(updateData)
      .where(eq(meetings.id, id))
      .returning();

    if (!meeting) throw new AppError(404, 'Meeting not found');

    // Replace attendees
    if (data.attendees) {
      await tx.delete(meetingAttendees).where(eq(meetingAttendees.meetingId, id));
      if (data.attendees.length > 0) {
        await tx.insert(meetingAttendees).values(
          data.attendees.map(a => ({
            meetingId: id,
            userId: a.userId,
            attended: a.attended ?? false,
          })),
        );
      }
    }

    // Replace decisions
    if (data.decisions) {
      await tx.delete(meetingDecisions).where(eq(meetingDecisions.meetingId, id));
      if (data.decisions.length > 0) {
        await tx.insert(meetingDecisions).values(
          data.decisions.map(d => ({
            meetingId: id,
            description: d.description,
            assignedTo: d.assignedTo || null,
            dueDate: d.dueDate || null,
            status: (d.status as any) || 'pending',
          })),
        );
      }
    }

    return meeting;
  });
}

export async function deleteMeeting(id: string) {
  const [meeting] = await db.delete(meetings).where(eq(meetings.id, id)).returning();
  if (!meeting) throw new AppError(404, 'Meeting not found');
  return { success: true };
}

export async function updateDecisionStatus(decisionId: string, status: string) {
  const [decision] = await db
    .update(meetingDecisions)
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(meetingDecisions.id, decisionId))
    .returning();
  if (!decision) throw new AppError(404, 'Decision not found');
  return decision;
}
