// Loans are quarterly: flat interest rate for 3 months, due in 3 months from activation.

// Calculate total due: principal + flat quarterly interest (set once at activation)
export function calculateTotalDue(loan) {
  // total_due is set at activation = amount * (1 + rate/100)
  return loan.total_due || loan.amount;
}

export function calculateRemaining(loan) {
  const due = calculateTotalDue(loan);
  return Math.max(0, Math.round((due - loan.amount_paid) * 100) / 100);
}

// Calculate due date: 3 months from activation
export function getDueDate(loan) {
  if (!loan.activated_at) return null;
  const due = new Date(loan.activated_at);
  due.setMonth(due.getMonth() + 3);
  return due;
}

export function isOverdue(loan) {
  if (loan.status !== "active") return false;
  const dueDate = getDueDate(loan);
  return dueDate && new Date() > dueDate;
}

// Calculate total_due at activation time: amount + flat quarterly interest
export function calculateTotalWithInterest(amount, interestRate) {
  return Math.round(amount * (1 + interestRate / 100) * 100) / 100;
}
