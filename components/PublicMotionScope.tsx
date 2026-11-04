'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function PublicMotionScope() {
  const pathname = usePathname();

  useEffect(() => {
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
    document.documentElement.classList.toggle('motion-enabled', !isAdminRoute);
  }, [pathname]);

  return null;
}
