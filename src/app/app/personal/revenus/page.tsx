import { redirect } from 'next/navigation';

export default function PersoRevenusPage() {
  redirect('/app/personal/transactions?type=INCOME');
}

