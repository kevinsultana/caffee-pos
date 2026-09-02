import { redirect } from 'next/navigation';

export default function ProductsIndexPage() {
  redirect('/dashboard/products/list');
}
