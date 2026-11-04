'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { useInView } from '@/lib/use-in-view';

type Props = HTMLAttributes<HTMLElement> & { children: ReactNode };

export default function RevealSection({ children, className = '', ...props }: Props) {
  const { ref, isVisible } = useInView<HTMLElement>();

  return (
    <section
      {...props}
      ref={ref}
      data-motion-visible={isVisible}
      className={`reveal-section ${isVisible ? 'is-visible' : ''} ${className}`}
    >
      {children}
    </section>
  );
}
