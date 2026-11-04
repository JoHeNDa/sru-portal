export type EventRow = {
  id: number; title: string; venue_date: string | null; description: string | null; image_path: string | null;
  starts_on: string | null; ends_on: string | null; register_url: string | null; is_paid: boolean; fee_amount: number | null;
};

// Today's date in the visitor's own time zone, as YYYY-MM-DD. Call this only inside effects or handlers.
export const localToday = () => new Date().toLocaleDateString('en-CA');

// An event is upcoming until its last day has passed. An event with no date stays upcoming.
// Until today's date is known, nothing counts as upcoming, so no button or fee flashes up for a past event.
export const isUpcoming = (e: Pick<EventRow, 'starts_on' | 'ends_on'>, today: string) =>
  !!today && (e.ends_on ?? e.starts_on ?? '9999-12-31') >= today;

export const feeLabel = (e: Pick<EventRow, 'is_paid' | 'fee_amount'>) =>
  e.is_paid ? `Fee: UGX ${Number(e.fee_amount ?? 0).toLocaleString('en-US')}` : 'Free';

// Only web links are allowed as registration links.
export const safeUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null);
