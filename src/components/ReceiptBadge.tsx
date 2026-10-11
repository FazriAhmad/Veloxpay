import React from 'react';
import { PayrollSlip } from '../lib/mockData';

const STYLE = {
  Awaiting: ['Menunggu konfirmasi', 'bg-amber-50 text-amber-700 border-amber-200'],
  Received: ['Diterima', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
  Disputed: ['Dipersoalkan', 'bg-rose-50 text-rose-700 border-rose-200'],
} as const;

// Only meaningful once a slip is Paid; renders nothing before that.
export const ReceiptBadge: React.FC<{ slip: PayrollSlip }> = ({ slip }) => {
  if (slip.status !== 'Paid' || !slip.receiptStatus) return null;
  const [label, cls] = STYLE[slip.receiptStatus];
  return <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border whitespace-nowrap ${cls}`}>{label}</span>;
};
