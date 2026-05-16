/**
 * Translates Move abort codes and Sui RPC errors into human-readable messages.
 */

const MOVE_ERRORS: Record<number, string> = {
  1: "Only the form creator can perform this action.",
  2: "This form is currently paused and not accepting submissions.",
  5: "The reward pool does not have enough SUI to fund the reward. Top up the pool or reduce the reward amount.",
  6: "This form requires on-chain eligibility proof. Make sure you meet the requirements.",
  7: "The eligibility token type does not match what this form requires.",
  8: "Your wallet does not hold enough of the required token to submit.",
  9: "You are not authorized to perform this action with the connected wallet.",
  10: "A form with this DNA already exists. Each form must have a unique identity.",
  12: "Invalid action type specified.",
  13: "Form DNA cannot be empty.",
  14: "Form schema cannot be empty.",
  15: "Response data cannot be empty.",
  16: "This form has expired and is no longer accepting submissions.",
  17: "Submission limit reached. Either you have already submitted the maximum number of times, or the form has reached its total submission cap.",
  18: "The reward amount is locked after the first submission and cannot be changed.",
  19: "This form's pool has been drained and the form is permanently deactivated.",
  21: "Blob ID is too long.",
  22: "Invalid limits or role count for this action.",
  23: "No pending creator transfer exists for this form.",
  24: "Only the pending new creator can accept this ownership transfer.",
  25: "Scheduled drain is not ready yet. Wait for the delay window or cancel the schedule.",
  26: "Invalid eligibility mode selected for this form.",
};

/**
 * Translate a raw error into a user-friendly message.
 * Handles Move abort codes, Sui RPC errors, and generic errors.
 */
export function translateError(error: unknown): string {
  if (typeof error === "string") return translateErrorString(error);
  if (error instanceof Error) return translateErrorString(error.message);
  return "Something went wrong. Please try again.";
}

function translateErrorString(message: string): string {
  // Match Move abort code patterns:
  // "MoveAbort(..., N)" or "abort code N" or "Abort code: N"
  const abortMatch =
    message.match(/MoveAbort\([^)]+,\s*(\d+)\)/) ??
    message.match(/abort\s+code\s*:?\s*(\d+)/i) ??
    message.match(/Abort\s+code\s*:?\s*(\d+)/i);

  if (abortMatch) {
    const code = parseInt(abortMatch[1], 10);
    if (MOVE_ERRORS[code]) return MOVE_ERRORS[code];
    return `Transaction failed (error code ${code}). Please try again.`;
  }

  // Sui-specific errors
  if (message.includes("InsufficientGas") || message.includes("insufficient gas")) {
    return "Not enough SUI to pay for gas. Add more SUI to your wallet and try again.";
  }

  if (message.includes("ObjectNotFound") || message.includes("object not found")) {
    return "The form could not be found on chain. It may have been deleted or the link is incorrect.";
  }

  if (message.includes("UserRejected") || message.includes("user rejected") || message.includes("User Rejected")) {
    return "Transaction was cancelled.";
  }

  if (message.includes("E_SUBMISSION_LIMIT") || message.includes("submission limit")) {
    return MOVE_ERRORS[17];
  }

  if (message.includes("E_FORM_PAUSED") || message.includes("form paused")) {
    return MOVE_ERRORS[2];
  }

  if (message.includes("E_FORM_EXPIRED") || message.includes("form expired")) {
    return MOVE_ERRORS[16];
  }

  if (message.includes("E_FORM_DRAINED") || message.includes("form drained")) {
    return MOVE_ERRORS[19];
  }

  if (message.includes("E_NOT_AUTHORIZED") || message.includes("not authorized")) {
    return MOVE_ERRORS[9];
  }

  if (message.includes("E_NOT_CREATOR") || message.includes("not creator")) {
    return MOVE_ERRORS[1];
  }

  if (message.includes("E_ALREADY_SUBMITTED") || message.includes("already submitted")) {
    return MOVE_ERRORS[3];
  }

  if (message.includes("E_INSUFFICIENT_POOL") || message.includes("insufficient pool")) {
    return MOVE_ERRORS[5];
  }

  if (message.includes("E_REWARD_LOCKED") || message.includes("reward locked")) {
    return MOVE_ERRORS[18];
  }

  if (message.includes("E_INVALID_LIMITS") || message.includes("invalid limits")) {
    return MOVE_ERRORS[22];
  }

  if (message.includes("E_NO_PENDING_CREATOR") || message.includes("no pending creator")) {
    return MOVE_ERRORS[23];
  }

  if (message.includes("E_NOT_PENDING_CREATOR") || message.includes("not pending creator")) {
    return MOVE_ERRORS[24];
  }

  if (message.includes("E_DRAIN_NOT_READY") || message.includes("drain not ready")) {
    return MOVE_ERRORS[25];
  }

  // Walrus errors
  if (message.includes("Walrus") || message.includes("walrus")) {
    return "Failed to store data on Walrus. Please try again in a moment.";
  }

  // If the message is already reasonably short and readable, pass it through
  if (message.length < 120 && !message.includes("0x") && !message.includes("Error(")) {
    return message;
  }

  return "Something went wrong. Please try again.";
}
