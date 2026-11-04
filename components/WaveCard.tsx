'use client';

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { useInView } from '@/lib/use-in-view';

type Props = HTMLAttributes<HTMLDivElement> & { children: ReactNode; index?: number };

export default function WaveCard({ children, className = '', index = 0, ...props }: Props) {
  const { ref, isVisible } = useInView<HTMLDivElement>(0.06);
  return (
    <div
      {...props}
      ref={ref}
      data-motion-visible={isVisible}
      style={{ ...props.style, '--reveal-delay': isVisible ? `${Math.min(index, 8) * 90}ms` : '0ms' } as CSSProperties}
      className={`wave-card ${isVisible ? 'is-visible' : ''} ${className}`}
    >
      {children}
    </div>
  );
}