import { IdeaGenerationCadence } from './enums/idea-generation-cadence.enum';

type ScheduleInput = {
  cadence: IdeaGenerationCadence;
  timeOfDay: string;
  weekday: number | null;
  timezone: string;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const DEFAULT_TIMEZONE = 'Europe/Paris';

function getParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function safeParts(date: Date, timezone: string): ZonedParts {
  try {
    return getParts(date, timezone);
  } catch {
    return getParts(date, DEFAULT_TIMEZONE);
  }
}

function getOffsetMs(timezone: string, date: Date): number {
  const parts = safeParts(date, timezone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return localAsUtc - date.getTime();
}

function zonedTimeToUtc(parts: ZonedParts, timezone: string): Date {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const offset = getOffsetMs(timezone, new Date(utcGuess));

  return new Date(utcGuess - offset);
}

function addLocalDays(parts: ZonedParts, days: number): ZonedParts {
  const next = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  );

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function localWeekday(parts: ZonedParts): number {
  const day = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day),
  ).getUTCDay();

  return day === 0 ? 7 : day;
}

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (!match) {
    return { hour: 9, minute: 0 };
  }

  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function buildIdeaGenerationCronExpression(input: ScheduleInput) {
  const time = parseTime(input.timeOfDay);

  if (input.cadence === IdeaGenerationCadence.DAILY) {
    return `${time.minute} ${time.hour} * * *`;
  }

  const weekday = input.weekday === 7 ? 0 : (input.weekday ?? 1);

  return `${time.minute} ${time.hour} * * ${weekday}`;
}

export function calculateNextIdeaRunAt(
  input: ScheduleInput,
  from: Date = new Date(),
): Date {
  const timezone = input.timezone?.trim() || DEFAULT_TIMEZONE;
  const nowParts = safeParts(from, timezone);
  const time = parseTime(input.timeOfDay);
  const candidateParts: ZonedParts = {
    year: nowParts.year,
    month: nowParts.month,
    day: nowParts.day,
    hour: time.hour,
    minute: time.minute,
    second: 0,
  };

  if (input.cadence === IdeaGenerationCadence.DAILY) {
    const todayRun = zonedTimeToUtc(candidateParts, timezone);

    return todayRun > from
      ? todayRun
      : zonedTimeToUtc(addLocalDays(candidateParts, 1), timezone);
  }

  const targetWeekday = input.weekday ?? 1;
  const currentWeekday = localWeekday(nowParts);
  let daysUntil = targetWeekday - currentWeekday;

  if (daysUntil < 0) {
    daysUntil += 7;
  }

  const weeklyParts = addLocalDays(candidateParts, daysUntil);
  const weeklyRun = zonedTimeToUtc(weeklyParts, timezone);

  return weeklyRun > from
    ? weeklyRun
    : zonedTimeToUtc(addLocalDays(weeklyParts, 7), timezone);
}
