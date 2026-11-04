import { Suspense } from 'react';
import ProfileView from '@/components/ProfileView';

async function Inner({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <ProfileView id={id ?? ''} />;
}

export default function ProfilePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return <Suspense fallback={<main className="p-8">Loading...</main>}><Inner searchParams={searchParams} /></Suspense>;
}
