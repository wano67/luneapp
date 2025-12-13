// src/app/login/page.tsx
import LoginForm from './LoginForm';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { from?: string };
}) {
  const from = searchParams?.from;

  const redirectPath =
    typeof from === 'string' && from.length > 0 ? from : '/app';

  return <LoginForm redirectPath={redirectPath} />;
}
