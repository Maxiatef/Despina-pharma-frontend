export type {
  Approval, Brief, CatalogItem, Doc, Paged, ProjectDetail, ProjectProduct, QuoteDetail, SampleDetail, StageTemplate,
} from '@/lib/types';

/** Row of GET /projects/:id/timeline (status_events). */
export interface StatusEventLike {
  id: string;
  createdAt: string;
  note: string | null;
  toStatus: string | null;
  actorId: string | null;
}
