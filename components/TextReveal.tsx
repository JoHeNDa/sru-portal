'use client';

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { useInView } from '@/lib/use-in-view';

type Props = HTMLAttributes<HTMLSpanElement> & { children: ReactNode; delay?: number };

export default function TextReveal({ children, className = '', delay = 0, style, ...props }: Props) {
  const { ref, isVisible } = useInView<HTMLSpanElement>(0.08);

  return (
    <span
      {...props}
      ref={ref}
      data-motion-visible={isVisible}
      style={{ ...style, '--text-reveal-delay': `${delay}ms` } as CSSProperties}
      className={`text-mask-reveal ${isVisible ? 'is-visible' : ''} ${className}`}
    >
      <span>{children}</span>
    </span>
  );
}
