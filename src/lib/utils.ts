/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'ريال') {
  return new Intl.NumberFormat('en-US').format(amount) + ' ' + currency;
}

export function calculateAdherence(planned: number, actual: number) {
  if (planned === 0) return actual === 0 ? 100 : 0;
  const rate = (actual / planned) * 100;
  return Math.min(Math.max(rate, 0), 100);
}
