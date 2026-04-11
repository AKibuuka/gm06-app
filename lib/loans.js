// Calculate total due with accrued interest (on-read calculation)
export function calculateTotalDue(loan) {
  if (!loan.activated_at || !["active"].includes(loan.status)) {
    return loan.total_due || loan.amount;
  }
  const months = monthsBetween(new Date(loan.activated_at), new Date());
  const interest = loan.amount * (loan.interest_rate / 100) * (months / 12);
  return Math.round((loan.amount + interest) * 100) / 100;
}

export function calculateRemaining(loan) {
  const due = calculateTotalDue(loan);
  return Math.max(0, Math.round((due - loan.amount_paid) * 100) / 100);
}

function monthsBetween(start, end) {
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
}
