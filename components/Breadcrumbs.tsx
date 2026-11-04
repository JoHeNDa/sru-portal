'use client';
import Link from 'next/link';
import Icon from '@/components/Icon';

export type Crumb = { label: string; href?: string };

export default function Breadcrumbs({ items, className = '' }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`text-xs sm:text-sm ${className}`}>
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" aria-label="Home" className="inline-flex items-center gap-1 text-gray-500 transition hover:text-gray-950">
            <Icon name="home" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </li>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-gray-400">/</span>
              {!isLast && item.href ? (
                <Link href={item.href} className="text-gray-600 transition hover:text-gray-950">{item.label}</Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className={isLast ? 'font-medium text-gray-900' : 'text-gray-600'}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
