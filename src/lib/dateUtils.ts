import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';

export function formatLastSeen(date: Date | number): string {
  const d = new Date(date);
  if (isToday(d)) {
    return `Bugün ${format(d, 'HH:mm', { locale: tr })}`;
  } else if (isYesterday(d)) {
    return `Dün ${format(d, 'HH:mm', { locale: tr })}`;
  } else if (differenceInDays(new Date(), d) < 7) {
    return format(d, 'EEEE HH:mm', { locale: tr });
  } else {
    return format(d, 'd MMMM yyyy HH:mm', { locale: tr });
  }
}
