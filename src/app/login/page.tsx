// src/app/login/page.tsx
import LoginForm from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const from = sp.from;

  const redirectPath =
    typeof from === 'string' && from.length > 0 ? from : '/app';

  return <LoginForm redirectPath={redirectPath} />;
}
