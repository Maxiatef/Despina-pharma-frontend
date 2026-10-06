'use client';

import { use } from 'react';
import { ProjectWorkspace } from '@/components/app/ProjectWorkspace';

export default function AdminProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProjectWorkspace id={id} backHref="/admin/projects/" />;
}
