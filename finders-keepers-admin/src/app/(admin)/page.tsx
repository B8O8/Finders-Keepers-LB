// This file redirects to /dashboard to avoid conflict with app/page.tsx at route "/"
// DELETE app/page.tsx for production build (Next.js disallows two pages at the same route)
import { redirect } from 'next/navigation';

export default function AdminRootPage() {
  redirect('/dashboard');
}
