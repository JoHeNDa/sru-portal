import { Suspense } from 'react';
import ArticleView from '@/components/ArticleView';

async function Inner({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <ArticleView id={id ?? ''} />;
}

export default function ArticlePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return <Suspense fallback={<main className="p-8">Loading...</main>}><Inner searchParams={searchParams} /></Suspense>;
}
