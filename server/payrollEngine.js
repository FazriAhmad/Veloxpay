// PPh 21 and BPJS calculations for Indonesian payroll.
//
// ponytail: PPh 21 here uses the statutory annual PTKP + progressive bracket method
// (Pasal 17 UU HPP), applied by annualizing the month's gross income — not DJP's
// official monthly TER (Tarif Efektif Rata-rata) lookup tables that most employers
// are required to use since PMK 168/2023. TER needs ~30 published rate tables keyed
// by PTKP category and income band; this gives a defensible estimate from the same
// underlying rates without transcribing those tables. Swap in the real TER tables
// (and a proper annual reconciliation in December) before this drives real tax
// withholding or reporting. Rates below are current as of the 2024 regulations in
// force at the time this was written and will drift — review yearly.

// Annual PTKP (non-taxable income) by marital/dependents status.
const PTKP_ANNUAL = {
  'TK/0': 54_000_000,
  'TK/1': 58_500_000,
  'TK/2': 63_000_000,
  'TK/3': 67_500_000,
  'K/0': 58_500_000,
  'K/1': 63_000_000,
  'K/2': 67_500_000,
  'K/3': 72_000_000,
};

// Pasal 17 UU HPP progressive brackets, annual taxable income (PKP) in Rupiah.
const PPH21_BRACKETS = [
  { upTo: 60_000_000, rate: 0.05 },
  { upTo: 250_000_000, rate: 0.15 },
  { upTo: 500_000_000, rate: 0.25 },
  { upTo: 5_000_000_000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
];

// "Biaya jabatan" (statutory position-cost deduction): 5% of gross, capped monthly.
const POSITION_COST_RATE = 0.05;
const POSITION_COST_MONTHLY_CAP = 500_000;

const BPJS_KESEHATAN_EMPLOYEE_RATE = 0.01;
const BPJS_KESEHATAN_SALARY_CAP = 12_000_000;

const BPJS_JHT_EMPLOYEE_RATE = 0.02;
const BPJS_JP_EMPLOYEE_RATE = 0.01;
const BPJS_JP_SALARY_CAP = 10_547_400; // 2024 cap, adjusted yearly by government regulation

export function getPtkpStatuses() {
  return Object.keys(PTKP_ANNUAL);
}

function progressiveTax(taxableAnnual) {
  let remaining = Math.max(0, taxableAnnual);
  let tax = 0;
  let lowerBound = 0;
  for (const bracket of PPH21_BRACKETS) {
    const bandSize = bracket.upTo - lowerBound;
    const taxedInBand = Math.min(remaining, bandSize);
    if (taxedInBand <= 0) break;
    tax += taxedInBand * bracket.rate;
    remaining -= taxedInBand;
    lowerBound = bracket.upTo;
  }
  return tax;
}

// Estimates one month's PPh 21 withholding from that month's gross salary
// (excluding overtime, which this simplified model treats as non-recurring and
// outside the annualized base — a real TER-table calculation would include it).
export function calculatePph21Monthly(monthlyGross, ptkpStatus) {
  const ptkpAnnual = PTKP_ANNUAL[ptkpStatus] ?? PTKP_ANNUAL['TK/0'];
  const positionCostMonthly = Math.min(monthlyGross * POSITION_COST_RATE, POSITION_COST_MONTHLY_CAP);
  const annualNetIncome = (monthlyGross - positionCostMonthly) * 12;
  const annualTaxable = Math.max(0, annualNetIncome - ptkpAnnual);
  const annualTax = progressiveTax(annualTaxable);
  return Math.round(annualTax / 12);
}

// Employee-side BPJS deductions only — employer contributions (JKK, JKM, and the
// larger share of Kesehatan/JHT/JP) are a company cost, not a payslip deduction,
// so they're not modeled here since VeloxPay only tracks what changes take-home pay.
export function calculateBpjsEmployeeDeductions(baseSalary) {
  const kesehatan = Math.round(Math.min(baseSalary, BPJS_KESEHATAN_SALARY_CAP) * BPJS_KESEHATAN_EMPLOYEE_RATE);
  const jht = Math.round(baseSalary * BPJS_JHT_EMPLOYEE_RATE);
  const jp = Math.round(Math.min(baseSalary, BPJS_JP_SALARY_CAP) * BPJS_JP_EMPLOYEE_RATE);
  return { kesehatan, jht, jp, total: kesehatan + jht + jp };
}

// THR (Tunjangan Hari Raya): one month's base salary, pro-rated for employees with
// under 12 months of tenure at the given reference date, per Permenaker 6/2016.
export function calculateThr(baseSalary, joinDate, referenceDate = new Date()) {
  const join = new Date(joinDate);
  const monthsWorked = Math.min(
    12,
    (referenceDate.getFullYear() - join.getFullYear()) * 12 + (referenceDate.getMonth() - join.getMonth())
  );
  if (monthsWorked < 1) return 0;
  return Math.round((baseSalary * monthsWorked) / 12);
}

// Flags pay below a configurable minimum wage floor. VeloxPay tracks one company-wide
// floor rather than real regional UMR/UMK, which vary by province/city and change
// yearly — plug in a per-region table before relying on this for compliance checks.
export function isBelowMinimumWage(baseSalary, regionalMinimum) {
  return baseSalary < regionalMinimum;
}
