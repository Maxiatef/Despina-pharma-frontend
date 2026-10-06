'use client';

import { use } from 'react';
import { ProjectWorkspace } from '@/components/app/ProjectWorkspace';

export default function PortalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProjectWorkspace id={id} backHref="/portal/projects/" />;
}
