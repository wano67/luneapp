import { redirect } from 'next/navigation';

export default function PersonalDashFinancesRedirect() {
  redirect('/app/personal/transactions');
}
