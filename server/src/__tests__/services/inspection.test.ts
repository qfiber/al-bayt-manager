import { describe, it, expect } from 'vitest';
import { generateICS } from '../../services/inspection.service.js';

describe('generateICS', () => {
  it('produces valid ICS format', () => {
    const ics = generateICS({
      title: 'Building Inspection',
      description: 'Annual fire safety check',
      scheduledAt: new Date('2026-04-01T10:00:00Z'),
      duration: '90',
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Building Inspection');
    expect(ics).toContain('DESCRIPTION:Annual fire safety check');
  });

  it('defaults to 60 min duration', () => {
    const ics = generateICS({
      title: 'Quick Visit',
      scheduledAt: new Date('2026-04-01T10:00:00Z'),
      duration: null,
    });

    expect(ics).toContain('BEGIN:VEVENT');
    // 60 minutes from 10:00 = 11:00
    expect(ics).toContain('DTEND:20260401T110000Z');
  });

  it('handles null description', () => {
    const ics = generateICS({
      title: 'Test',
      description: null,
      scheduledAt: new Date('2026-04-01T10:00:00Z'),
    });

    expect(ics).toContain('DESCRIPTION:');
    expect(ics).not.toContain('null');
  });
});
