import { Suspense } from 'react';
import EventView from '@/components/EventView';

async function Inner({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <EventView id={id ?? ''} />;
}

export default function EventPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return <Suspense fallback={<main className="p-8">Loading...</main>}><Inner searchParams={searchParams} /></Suspense>;
}
