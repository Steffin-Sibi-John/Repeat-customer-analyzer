/**
 * CSV Analyzer Module — Fixed Version
 *
 * Bug fixes over original:
 * 1. Proper quoted-CSV parsing (handles commas inside quoted fields)
 * 2. Monthly classification based on FINAL purchase history, not row order
 */

export interface MonthlyData {
  month: string;
  new: number;
  repeat: number;
}

export interface CountryData {
  country: string;
  rate: number;
  repeatCount: number;
  totalCount: number;
}

export interface AnalysisResult {
  total_customers: number;
  repeat_customers: number;
  one_time_customers: number;
  repeat_pct: string;
  avg_orders: string;
  monthly: MonthlyData[];
  country_data: CountryData[];
}

/**
 * Properly parse a single CSV line, handling quoted fields with commas inside.
 * e.g. 'Alice,"West Elm, Ltd",UK' => ['Alice', 'West Elm, Ltd', 'UK']
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function findCol(header: string[], ...keywords: string[]): number {
  return header.findIndex(h => {
    const lower = h.toLowerCase().replace(/\s/g, '_');
    return keywords.some(k => lower.includes(k.toLowerCase().replace(/\s/g, '_')));
  });
}

export function analyzeCSV(csvContent: string): AnalysisResult {
  const lines = csvContent.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    throw new Error('CSV file must contain a header and at least one data row');
  }

  const header = parseCSVLine(lines[0]);
  const customerIdIdx = findCol(header, 'customer_id', 'customerid', 'customer id', 'cust_id');
  const invoiceIdx    = findCol(header, 'invoice', 'invoice_no', 'order_id', 'transaction');
  const countryIdx    = findCol(header, 'country', 'region');
  const dateIdx       = findCol(header, 'invoicedate', 'invoice_date', 'date', 'orderdate');

  if (customerIdIdx === -1) throw new Error(`No Customer ID column found. Detected: ${header.slice(0, 6).join(', ')}`);
  if (invoiceIdx === -1)    throw new Error(`No Invoice column found. Detected: ${header.slice(0, 6).join(', ')}`);

  // Pass 1: build complete purchase history
  const customerInvoices = new Map<string, Set<string>>();
  const customerCountry  = new Map<string, string>();
  const purchaseEvents: Array<{ customerId: string; month: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const parts      = parseCSVLine(lines[i]);
    const customerId = parts[customerIdIdx]?.trim();
    const invoice    = parts[invoiceIdx]?.trim();
    if (!customerId || !invoice || customerId.toLowerCase() === 'nan') continue;

    if (!customerInvoices.has(customerId)) customerInvoices.set(customerId, new Set());
    customerInvoices.get(customerId)!.add(invoice);

    if (countryIdx >= 0 && !customerCountry.has(customerId)) {
      const c = parts[countryIdx]?.trim();
      if (c && c.toLowerCase() !== 'nan') customerCountry.set(customerId, c);
    }

    if (dateIdx >= 0) {
      const month = extractMonth(parts[dateIdx] ?? '');
      if (month) purchaseEvents.push({ customerId, month });
    }
  }

  const totalCustomers = customerInvoices.size;
  if (totalCustomers === 0) throw new Error('No valid customer records found.');

  const repeatSet = new Set<string>();
  customerInvoices.forEach((inv, id) => { if (inv.size >= 2) repeatSet.add(id); });

  const repeatCustomers  = repeatSet.size;
  const oneTimeCustomers = totalCustomers - repeatCustomers;
  const repeatPct        = ((repeatCustomers / totalCustomers) * 100).toFixed(2);
  const totalInvoices    = Array.from(customerInvoices.values()).reduce((s, v) => s + v.size, 0);
  const avgOrders        = (totalInvoices / totalCustomers).toFixed(2);

  // Monthly trend — classify by FINAL history (fix for original bug)
  const monthlyNew    = new Map<string, Set<string>>();
  const monthlyRepeat = new Map<string, Set<string>>();

  for (const { customerId, month } of purchaseEvents) {
    const bucket = repeatSet.has(customerId) ? monthlyRepeat : monthlyNew;
    if (!bucket.has(month)) bucket.set(month, new Set());
    bucket.get(month)!.add(customerId);
  }

  const allMonths = new Set([...monthlyNew.keys(), ...monthlyRepeat.keys()]);
  const monthly: MonthlyData[] = Array.from(allMonths).sort().map(month => ({
    month,
    new:    monthlyNew.get(month)?.size    ?? 0,
    repeat: monthlyRepeat.get(month)?.size ?? 0,
  }));

  // Country breakdown
  const countryStats = new Map<string, { repeat: number; total: number }>();
  customerInvoices.forEach((inv, id) => {
    const c = customerCountry.get(id) ?? 'Unknown';
    if (!countryStats.has(c)) countryStats.set(c, { repeat: 0, total: 0 });
    const s = countryStats.get(c)!;
    s.total++;
    if (inv.size >= 2) s.repeat++;
  });

  const country_data: CountryData[] = Array.from(countryStats.entries())
    .filter(([, s]) => s.total >= 5)
    .map(([country, s]) => ({
      country,
      rate: parseFloat(((s.repeat / s.total) * 100).toFixed(2)),
      repeatCount: s.repeat,
      totalCount:  s.total,
    }))
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 20);

  return { total_customers: totalCustomers, repeat_customers: repeatCustomers, one_time_customers: oneTimeCustomers, repeat_pct: repeatPct, avg_orders: avgOrders, monthly, country_data };
}

function extractMonth(dateStr: string): string | null {
  if (!dateStr) return null;
  const s = dateStr.trim().replace(/"/g, '');
  const iso = s.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}`;
  const eu = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (eu) return `${eu[3]}-${eu[2].padStart(2, '0')}`;
  return null;
}
