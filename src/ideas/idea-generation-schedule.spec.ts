import { IdeaGenerationCadence } from './enums/idea-generation-cadence.enum';
import {
  buildIdeaGenerationCronExpression,
  calculateNextIdeaRunAt,
} from './idea-generation-schedule';

describe('calculateNextIdeaRunAt', () => {
  it('returns today when the daily local time has not passed', () => {
    const nextRun = calculateNextIdeaRunAt(
      {
        cadence: IdeaGenerationCadence.DAILY,
        timeOfDay: '09:00',
        weekday: null,
        timezone: 'Europe/Paris',
      },
      new Date('2026-01-10T07:00:00.000Z'),
    );

    expect(nextRun.toISOString()).toBe('2026-01-10T08:00:00.000Z');
  });

  it('returns the next day when the daily local time has passed', () => {
    const nextRun = calculateNextIdeaRunAt(
      {
        cadence: IdeaGenerationCadence.DAILY,
        timeOfDay: '09:00',
        weekday: null,
        timezone: 'Europe/Paris',
      },
      new Date('2026-01-10T09:30:00.000Z'),
    );

    expect(nextRun.toISOString()).toBe('2026-01-11T08:00:00.000Z');
  });

  it('returns the selected weekday for weekly generation', () => {
    const nextRun = calculateNextIdeaRunAt(
      {
        cadence: IdeaGenerationCadence.WEEKLY,
        timeOfDay: '09:00',
        weekday: 1,
        timezone: 'Europe/Paris',
      },
      new Date('2026-01-10T09:30:00.000Z'),
    );

    expect(nextRun.toISOString()).toBe('2026-01-12T08:00:00.000Z');
  });

  it('builds the daily cron expression for the selected local time', () => {
    expect(
      buildIdeaGenerationCronExpression({
        cadence: IdeaGenerationCadence.DAILY,
        timeOfDay: '14:35',
        weekday: null,
        timezone: 'Europe/Paris',
      }),
    ).toBe('35 14 * * *');
  });

  it('builds the weekly cron expression for the selected weekday', () => {
    expect(
      buildIdeaGenerationCronExpression({
        cadence: IdeaGenerationCadence.WEEKLY,
        timeOfDay: '08:05',
        weekday: 7,
        timezone: 'Europe/Paris',
      }),
    ).toBe('5 8 * * 0');
  });
});
