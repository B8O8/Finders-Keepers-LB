// Root route — redirects to dashboard (auth is handled by the admin layout)
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/dashboard');
}
