/** Calendar periods clamp to the final day of the target month (UTC). */
export function subscriptionPeriodEnd(start: Date, cycle: 'monthly' | 'yearly'): Date {
  const end = new Date(start);
  const day = start.getUTCDate();
  end.setUTCDate(1);
  if (cycle === 'yearly') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end;
}
