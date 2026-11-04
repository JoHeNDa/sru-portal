export const fmt = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function Avatar({ name, src, size = 'h-10 w-10' }: { name: string; src?: string; size?: string }) {
  const ini = name.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  return src
    ? <img src={src} alt="" className={`${size} rounded-full object-cover`} />
    : <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-teal-800 text-sm font-semibold text-white`}>{ini}</span>;
}

// Shows whether an event is still ahead or already over.
export function StatusBadge({ upcoming }: { upcoming: boolean }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${upcoming ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
      {upcoming ? 'Upcoming' : 'Previous'}
    </span>
  );
}
