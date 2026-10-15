import { notFound } from 'next/navigation';
import { Portal } from '@/components/portal';
import { fixtures } from '@/features/fixtures';
import { sections } from '@/lib/permissions';
export const dynamic = 'force-dynamic';
export default async function Preview({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (
    process.env.NODE_ENV === 'production' ||
    !sections.includes(section as (typeof sections)[number])
  )
    notFound();
  return (
    <Portal
      section={section}
      preview
      previewPath
      data={fixtures}
      user={{
        id: 'preview',
        first_name: 'Kajan',
        last_name: 'Raj',
        job_title: 'CEO / Owner',
        roles: ['ceo'],
      }}
    />
  );
}
