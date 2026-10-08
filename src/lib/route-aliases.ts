/**
 * Other ways people type a page's address → the one real URL.
 *
 * `/sign-in`, `/SignIn`, `/log_in`, `/admin/login` … all lead to `/login/`. Lookup ignores
 * upper/lower case, a trailing slash and the separators `-`, `_`, `.` and spaces, so only
 * the distinct words need listing. A real page is never shadowed: aliases are only used for
 * addresses that are not pages (`check:aliases` in scripts/check-links.mjs verifies this).
 */
const ALIASES: Record<string, string[]> = {
  // ---------- sign-in & account (app pages) ----------
  '/login/': [
    'signin', 'logon', 'auth', 'auth/login', 'auth/signin', 'account/login', 'account/signin', 'user/login', 'users/login',
    'admin/login', 'admin/signin', 'portal/login', 'portal/signin', 'staff/login', 'customer/login', 'client/login', 'member/login',
    'members',
  ],
  '/forgot-password/': [
    'forgot', 'forgotpass', 'lostpassword', 'passwordforgot', 'password/forgot', 'recover', 'recoverpassword', 'recovery',
    'account/forgot-password', 'auth/forgot-password', 'login/forgot-password',
  ],
  '/reset-password/': ['passwordreset', 'password/reset', 'resetpass', 'auth/reset-password', 'account/reset-password', 'set-password', 'new-password'],
  '/accept-invite/': ['invite', 'invitation', 'acceptinvitation', 'join', 'auth/accept-invite', 'register/invite'],
  '/admin/': ['dashboard', 'staff', 'backoffice', 'backend', 'cms', 'admin/dashboard', 'admin/home', 'administrator', 'manage', 'management'],
  '/portal/': [
    'customer', 'customers/portal', 'customer-portal', 'client', 'client-portal', 'clientarea', 'workspace', 'my-workspace',
    'my-account', 'myaccount', 'portal/home', 'portal/dashboard', 'customer/dashboard',
  ],
  '/portal/projects/': ['my-projects', 'portal/my-projects', 'customer/projects'],
  '/admin/inquiries/': ['admin/leads', 'admin/inquiry', 'admin/enquiries', 'leads', 'inquiries', 'enquiries', 'admin/requests'],
  '/admin/tasks/': ['admin/task', 'admin/follow-ups', 'admin/followups', 'admin/todo', 'tasks', 'follow-ups', 'followups'],
  '/admin/projects/': ['admin/project'],
  '/admin/companies/': ['admin/company', 'admin/clients', 'admin/customers', 'admin/brands'],
  '/admin/contacts/': ['admin/contact', 'admin/people'],
  '/admin/users/': ['admin/user', 'admin/staff', 'admin/team'],
  '/admin/emails/': ['admin/email', 'admin/email-log', 'admin/mail'],
  '/admin/audit/': ['admin/audit-log', 'admin/activity', 'admin/logs'],
  '/admin/catalog/': ['admin/products', 'admin/catalogue', 'admin/library'],
  '/admin/stage-templates/': ['admin/stages', 'admin/templates'],
  '/admin/account/': ['admin/profile', 'admin/settings', 'admin/security', 'admin/mfa', 'admin/2fa'],
  '/portal/account/': ['portal/profile', 'portal/settings', 'profile', 'settings'],

  // ---------- public website ----------
  '/': ['home', 'homepage', 'index', 'main', 'start-page'],
  '/contact/': ['contact-us', 'contacts', 'get-in-touch', 'reach-us', 'support', 'help-desk', 'enquiry', 'inquiry', 'ask', 'ask-a-question', 'message-us'],
  '/about-us/': ['about', 'about-despina', 'who-we-are', 'company', 'our-story', 'our-company'],
  '/products/': ['product', 'product-library', 'catalog', 'catalogue', 'shop', 'store', 'library', 'range', 'products-library'],
  '/formulations/': ['formulation', 'formula-development', 'formulas-library'],
  '/services/': ['service', 'capabilities', 'capability', 'what-we-do', 'solutions'],
  '/process/': ['our-process', 'how-it-works', 'how-we-work', 'workflow', 'steps'],
  '/blog/': ['resources', 'insights', 'news', 'articles', 'guides', 'insights-and-guides'],
  '/faq/': ['faqs', 'help', 'questions', 'common-questions', 'q-and-a', 'qa'],
  '/our-clients/': ['clients', 'customers', 'who-we-work-with', 'partners'],
  '/privacy-policy/': ['privacy', 'privacy-notice', 'data-protection', 'gdpr'],
  '/cookie-policy/': ['cookies', 'cookie', 'cookie-notice'],
  '/accessibility/': ['accessibility-statement', 'a11y'],
  '/forms/': ['project-forms', 'all-forms', 'form'],
  '/new-product-profile/': [
    'start', 'start-project', 'start-your-project', 'start-a-project', 'get-started', 'new-project', 'new-product', 'product-brief',
    'project-brief', 'brief', 'quote', 'get-a-quote', 'request-a-quote', 'request-quote', 'quotation', 'rfq',
  ],
  '/new-customer-profile/': ['company-profile', 'brand-profile', 'new-customer', 'new-client', 'customer-profile', 'register', 'signup', 'onboarding'],
  '/sample-feedback/': ['sample-review', 'review-sample', 'feedback', 'sample-reviews'],
  '/sample-request/': ['request-sample', 'request-a-sample', 'samples', 'sample', 'order-sample', 'free-sample', 'sample-order'],
  '/private-label/': ['privatelabel', 'white-label'],
  '/custom-formulation/': ['custom-formulas', 'custom-development'],
  '/packaging/': ['packaging-options', 'packaging-design'],
  '/quality-control/': ['quality', 'qc', 'quality-assurance', 'qa-qc'],
  '/manufacturer-references/': ['references', 'catalog-references'],
};

/** Lower-case, no trailing slash, separators removed inside each segment. */
export function normalizePath(pathname: string): string {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    /* keep raw */
  }
  return decoded
    .toLowerCase()
    .split('/')
    .map((seg) => seg.replace(/[-_.\s+]/g, ''))
    .filter(Boolean)
    .join('/');
}

const TABLE = new Map<string, string>();
for (const [target, aliases] of Object.entries(ALIASES)) {
  for (const a of aliases) TABLE.set(normalizePath(a), target);
  // The target itself in any spelling: /Login, /new_product_profile, /about%20us …
  TABLE.set(normalizePath(target), target);
}

/** The real URL for an alternative spelling, or null when the path is not a known alias. */
export function resolveAlias(pathname: string): string | null {
  const target = TABLE.get(normalizePath(pathname));
  if (!target) return null;
  // Already the exact real URL (with or without the trailing slash): nothing to do.
  if (pathname === target || `${pathname}/` === target) return null;
  return target;
}

/** For tests and the docs: every alias → target. */
export function aliasList(): [alias: string, target: string][] {
  return Object.entries(ALIASES).flatMap(([target, aliases]) => aliases.map((a) => [`/${a}/`, target] as [string, string]));
}
