import Link from 'next/link';
import Icon from '@/components/Icon';
import WaveCard from '@/components/WaveCard';

const groups = [
  { title: 'Explore', links: [['About SRU', '/#about'], ['News', '/#news'], ['Events', '/#events'], ['Committee', '/committee']] },
  { title: 'Membership', links: [['Become a member', '/join'], ['Member workspace', '/member'], ['Sign in', '/join']] },
];

export default function Footer() {
  return (
    <footer className="relative border-t-0 bg-[#101116] text-white">
      <div aria-hidden="true" className="brand-gradient-rule absolute inset-x-0 top-0" />
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.4fr_1fr_1fr_1.2fr] md:py-16">
        <WaveCard className="min-w-0" index={0}>
          <Link href="/" className="font-brand text-sm font-bold uppercase tracking-[0.12em] text-white">Society of Radiography of Uganda</Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/65">
            Advancing professional standards, lifelong learning, and quality imaging care across Uganda.
          </p>
          <Link href="/join" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-teal-50">
            Join the Society <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </WaveCard>
        {groups.map((group, index) => (
          <WaveCard key={group.title} index={index + 1}>
          <nav aria-label={group.title}>
            <h2 className="font-brand text-xs font-semibold uppercase tracking-[0.14em] text-white/50">{group.title}</h2>
            <ul className="mt-4 space-y-3">
              {group.links.map(([label, href]) => (
                <li key={href + label}><Link href={href} className="text-sm text-white/75 transition hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </nav>
          </WaveCard>
        ))}
        <WaveCard index={3}>
        <div id="footer-contact">
          <h2 className="font-brand text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Contact</h2>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li><Link href="/#contacts" className="inline-flex items-center gap-2 hover:text-white"><Icon name="mail" className="h-4 w-4" />Contact the Secretariat</Link></li>
            <li><Link href="/#contacts" className="inline-flex items-center gap-2 hover:text-white"><Icon name="location" className="h-4 w-4" />Uganda</Link></li>
          </ul>
        </div>
        </WaveCard>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-4 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>© Society of Radiography of Uganda. All rights reserved.</span>
          <span>Built for the radiography community in Uganda.</span>
        </div>
      </div>
    </footer>
  );
}
