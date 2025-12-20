import { redirect } from 'next/navigation';

// Redirect to the single Swagger UI entrypoint.
export default function ApiDocsPage() {
  redirect('/api-docs.html');
}
