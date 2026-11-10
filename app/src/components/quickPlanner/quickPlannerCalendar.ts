export function buildCalendarMonthMeta(cursor: Date, locale: 'en' | 'ru') {
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekdayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const dayCount = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat(dateLocale, { month: 'long', year: 'numeric' }).format(cursor);
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => (
    new Intl.DateTimeFormat(dateLocale, { weekday: 'short' }).format(new Date(2024, 0, index + 1))
  ));

  return {
    dateLocale,
    year,
    month,
    firstWeekdayOffset,
    dayCount,
    monthLabel,
    weekdayLabels,
    monthKey: year * 12 + month,
  };
}
