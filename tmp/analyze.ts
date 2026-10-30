import fs from 'fs';

const text = fs.readFileSync('/tmp/newsheet.csv', 'utf8');

function parseCSVRow(str: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"') {
      if (inQuotes && str[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

const lines = text.split(/\r?\n/).filter(Boolean);
console.log('Total lines:', lines.length);
const headers = parseCSVRow(lines[0]);
console.log('Headers:', headers);

const custIdx = headers.indexOf('Customer');
const statusIdx = headers.indexOf('Status');
const voidIdx = headers.indexOf('Void');
const dateIdx = headers.indexOf('Tanggal');
const totalIdx = headers.indexOf('Total');
const typeIdx = headers.indexOf('Type');

const customers: Record<string, number> = {};
const statuses: Record<string, number> = {};
const voidVals: Record<string, number> = {};
const statusByCustomer: Record<string, Record<string, number>> = {};
const dateRange: { min: string; max: string } = { min: '9999', max: '0000' };

for (let i = 1; i < lines.length; i++) {
  const r = parseCSVRow(lines[i]);
  const c = r[custIdx] || '';
  const s = r[statusIdx] || '';
  const v = r[voidIdx] || '';
  const d = r[dateIdx] || '';
  
  customers[c] = (customers[c] || 0) + 1;
  statuses[s] = (statuses[s] || 0) + 1;
  voidVals[v] = (voidVals[v] || 0) + 1;

  if (!statusByCustomer[c]) statusByCustomer[c] = {};
  statusByCustomer[c][s] = (statusByCustomer[c][s] || 0) + 1;

  if (d && d < dateRange.min) dateRange.min = d;
  if (d && d > dateRange.max) dateRange.max = d;
}

console.log('Customers count:', customers);
console.log('Statuses count:', statuses);
console.log('Void values:', voidVals);
console.log('Date range:', dateRange);
console.log('Status by Customer:', JSON.stringify(statusByCustomer, null, 2));
