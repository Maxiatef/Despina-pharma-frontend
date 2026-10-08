// Shapes returned by the NestJS backend (see despinapharma-backend/src/database/entities).
export type UserRole = 'admin' | 'sales' | 'rnd' | 'packaging' | 'quality' | 'production' | 'customer';
export const USER_ROLES: UserRole[] = ['admin', 'sales', 'rnd', 'packaging', 'quality', 'production', 'customer'];
export const STAFF_ROLES: UserRole[] = ['admin', 'sales', 'rnd', 'packaging', 'quality', 'production'];

export type InquiryStatus = 'new' | 'assigned' | 'awaiting_customer' | 'qualified' | 'quoted' | 'won' | 'lost' | 'closed' | 'not_a_fit';
export const INQUIRY_STATUSES: InquiryStatus[] = ['new', 'assigned', 'awaiting_customer', 'qualified', 'quoted', 'won', 'lost', 'closed', 'not_a_fit'];
export type FormType = 'contact' | 'new_customer' | 'new_product' | 'sample_request' | 'sample_feedback' | 'service';
export const FORM_TYPES: FormType[] = ['contact', 'new_customer', 'new_product', 'sample_request', 'sample_feedback', 'service'];
export const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'cancelled'] as const;
/** Contact-form topics (inquiries.inquiry_type). */
export const INQUIRY_TYPES: Record<string, string> = {
  general: 'General question', new_product: 'New product development', private_label: 'Private label / stock formula',
  sample_request: 'Sample request', quotation: 'Quotation / pricing', packaging_filling: 'Packaging & filling',
  existing_project: 'Existing project', partnership: 'Partnership / supplier', other: 'Other',
};
export const SAMPLE_STATUSES = ['requested', 'in_development', 'shipped', 'feedback_received', 'approved', 'rejected'] as const;
export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'changes_requested'] as const;
export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const CATALOG_KINDS = ['stock-reference', 'concept', 'base', 'development-program', 'despina-formula', 'assortment', 'product-type', 'format-option', 'program-service'] as const;
export const EMAIL_JOB_STATUSES = ['queued', 'sending', 'sent', 'failed'] as const;

export interface Me {
  id: string;
  email: string;
  role: UserRole;
  contactId: string | null;
  sessionId: string;
  companyIds: string[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Base {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company extends Base { name: string; website: string | null; country: string | null; industry: string | null; notes: string | null }
export interface Contact extends Base {
  companyId: string | null; firstName: string; lastName: string | null; email: string; phone: string | null;
  jobTitle: string | null; country: string | null; company?: Company | null;
}
export interface User extends Base { email: string; role: UserRole; isActive: boolean; mfaEnabled: boolean; lastLoginAt: string | null; contactId: string | null }

export interface InquiryRow extends Base {
  referenceNo: string; formType: FormType; inquiryType: string | null; status: InquiryStatus; contactId: string; companyId: string | null;
  message: string | null; payload: { form?: string; fields?: Record<string, string | string[]>; labels?: Record<string, string> } & Record<string, unknown>;
  sourcePage: string | null;
  contact: { firstName: string; lastName: string | null; email: string };
  companyName: string | null; assignee: { id: string; email: string } | null; nextDueAt: string | null;
}

export interface TimelineEntry {
  type: 'status' | 'message' | 'email' | 'document' | 'assignment' | 'task';
  at: string; actorId?: string | null; from?: string | null; to?: string | null; note?: string | null; body?: string;
  viaEmail?: boolean; kind?: string; status?: string; error?: string | null; documentId?: string; title?: string;
  userId?: string; by?: string | null; endedAt?: string | null; taskId?: string; dueAt?: string | null; completedAt?: string | null;
}

export interface Task extends Base {
  inquiryId: string | null; projectId: string | null; assigneeId: string | null; createdBy: string | null; title: string;
  priority: (typeof TASK_PRIORITIES)[number]; dueAt: string | null; completedAt: string | null;
  // Joined by GET /tasks
  inquiryRef?: string | null; inquiryStatus?: string | null; projectCode?: string | null; projectName?: string | null;
  companyName?: string | null; contactName?: string | null;
}

export interface DocumentVersion extends Base {
  documentId: string; versionNo: number; originalFilename: string; mimeType: string; sizeBytes: string; sha256: string;
  scanStatus: 'pending' | 'clean' | 'infected' | 'failed'; uploadedBy: string | null;
}
export interface Doc extends Base {
  inquiryId: string | null; projectId: string | null; companyId: string | null; uploadedBy: string | null; title: string;
  visibility: 'internal' | 'customer'; latestVersion?: DocumentVersion | null; versions?: DocumentVersion[];
}

export interface EmailJob extends Base {
  inquiryId: string | null; projectId: string | null; kind: string; toEmail: string; subject: string; status: string;
  attempts: number; lastError: string | null; sentAt: string | null; providerMessageId: string | null;
}

export interface InquiryDetail extends Omit<InquiryRow, 'contact' | 'companyName' | 'assignee' | 'nextDueAt'> {
  contact: Contact; company: Company | null;
  items: { id: string; catalog_item_id: string | null; catalog_item_name: string | null; catalog_item_slug: string | null; category_slug: string | null; service_id: string | null; service_title: string | null; quantity: number | null; notes: string | null }[];
  assignments: { id: string; userId: string; assignedBy: string | null; unassignedAt: string | null; createdAt: string }[];
  tasks: Task[]; documents: Doc[]; emails: EmailJob[];
  consents: { id: string; consentType: string; granted: boolean; policyVersion: string | null; createdAt: string }[];
  project: { id: string; code: string; name: string } | null;
  timeline: TimelineEntry[];
}

export interface ProjectStage extends Base {
  projectId: string; projectProductId: string | null; name: string; sortOrder: number; requiresRole: UserRole | null;
  startedAt: string | null; completedAt: string | null; completedBy: string | null;
}
export interface Sample extends Base { projectProductId: string; inquiryId: string | null; title: string; status: (typeof SAMPLE_STATUSES)[number] }
export interface ProjectProduct extends Base {
  projectId: string; catalogItemId: string | null; serviceId: string | null; name: string; targetQuantity: number | null; notes: string | null; samples?: Sample[];
  /** This product line's own stage track (stages per product line). */
  currentStageId: string | null; stages?: ProjectStage[]; stageSummary?: { done: number; total: number; current: string | null } | null;
}
export interface Quote extends Base { projectId: string; quoteNo: string; status: (typeof QUOTE_STATUSES)[number]; createdBy: string | null }
export interface QuoteLine extends Base { quoteVersionId: string; projectProductId: string | null; description: string; quantity: string; unitPrice: string; lineTotal: string; sortOrder: number }
export interface Approval extends Base {
  projectId: string; targetType: string; documentVersionId: string | null; sampleRevisionId: string | null; quoteVersionId: string | null;
  briefVersionId: string | null; targetHash: string; approverId: string; approverRole: UserRole; confirmationText: string; approvedAt: string;
}
export interface QuoteResponse extends Base {
  quoteId: string; quoteVersionId: string; decision: 'declined' | 'changes_requested'; note: string | null; respondedBy: string | null;
}
export interface QuoteVersion extends Base {
  quoteId: string; versionNo: number; currency: string; total: string; validUntil: string | null; documentVersionId: string | null;
  lines: QuoteLine[]; approvals: Approval[]; responses: QuoteResponse[];
}
export interface QuoteDetail extends Quote { versions: QuoteVersion[] }

export interface ProjectRow extends Base {
  code: string; companyId: string; name: string; status: (typeof PROJECT_STATUSES)[number]; stageTemplateId: string | null;
  currentStageId: string | null; ownerId: string | null; sourceInquiryId: string | null; companyName?: string; currentStage?: string | null;
}
export interface ProjectDetail extends ProjectRow {
  company: Company | null; owner: { id: string; email: string } | null; stages: ProjectStage[]; products: ProjectProduct[]; quotes: Quote[];
}

export interface BriefVersion extends Base { briefId: string; versionNo: number; content: Record<string, unknown>; createdBy: string | null }
export interface Brief extends Base { projectProductId: string; title: string; versions?: BriefVersion[] }
export interface Feedback extends Base { sampleRevisionId: string; authorId: string | null; rating: number | null; comments: string | null }
export interface SampleRevision extends Base { sampleId: string; revisionNo: number; description: string | null; shippedAt: string | null; trackingNo: string | null; feedback: Feedback[] }
export interface SampleDetail extends Sample { revisions: SampleRevision[] }
export interface Message extends Base { projectId: string | null; inquiryId: string | null; senderId: string | null; senderContactId: string | null; body: string; viaEmail: boolean }

export interface CatalogCategory { id: string; slug: string; title: string; description: string | null; sortOrder: number; isPublished: boolean; itemCount?: number }
export interface CatalogSource extends Base { code: string; name: string; website: string | null }
export interface CatalogItem extends Base {
  categoryId: string; sourceId: string | null; slug: string; name: string; kind: string; subgroup: string | null; ingredients: string[];
  notes: string | null; imageUrl: string | null; seoTitle: string | null; seoDescription: string | null; isPublished: boolean;
  category?: { slug: string; title: string } | null; source?: { code: string; name: string } | null;
}
export interface Service extends Base { slug: string; title: string; summary: string | null; body: string | null; sortOrder: number; isPublished: boolean }
export interface Faq extends Base { serviceId: string | null; question: string; answer: string; topic: string | null; sortOrder: number; isPublished: boolean }
export interface Redirect extends Base { fromPath: string; toPath: string; statusCode: number }
export interface StageTemplate extends Base { name: string; stages: { name: string; requiresRole?: UserRole }[]; isDefault: boolean }
export interface AuditEvent extends Base {
  actorId: string | null; actorEmail: string | null; actorRole: string | null; action: string; summary: string | null;
  entityType: string; entityId: string | null; entityLabel: string | null; projectId: string | null; inquiryId: string | null; companyId: string | null;
  before?: unknown; after?: unknown; ip: string | null; method: string | null; path: string | null; statusCode?: number | null; userAgent?: string | null;
  details?: { input?: unknown; changes?: { field: string; from: unknown; to: unknown }[]; events?: unknown; result?: unknown } | null;
}
export interface AuditFilters {
  entityTypes: string[]; actions: string[]; actionCounts: Record<string, number>; actors: { id: string; email: string; role: string; count: number }[];
}
export interface SessionRow { id: string; ip: string | null; userAgent: string | null; createdAt: string; expiresAt: string; current: boolean }
