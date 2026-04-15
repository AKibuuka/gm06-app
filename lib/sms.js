/**
 * Send SMS via Africa's Talking API.
 * Requires env vars: AT_API_KEY, AT_USERNAME, AT_SENDER_ID (optional)
 *
 * Phone numbers should be in international format: +256XXXXXXXXX
 */
export async function sendSMS(phone, message) {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;

  if (!apiKey || !username) {
    throw new Error("SMS service not configured. Set AT_API_KEY and AT_USERNAME.");
  }

  // Ensure phone has + prefix
  let to = phone.startsWith("+") ? phone : `+${phone}`;

  const params = new URLSearchParams({
    username,
    to,
    message,
  });
  if (process.env.AT_SENDER_ID) {
    params.append("from", process.env.AT_SENDER_ID);
  }

  const baseUrl = username === "sandbox"
    ? "https://api.sandbox.africastalking.com"
    : "https://api.africastalking.com";

  const res = await fetch(`${baseUrl}/version1/messaging`, {
    method: "POST",
    headers: {
      "apiKey": apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: params.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.SMSMessageData?.Message || "SMS send failed");
  }

  const recipients = data.SMSMessageData?.Recipients || [];
  const first = recipients[0];

  if (first && first.statusCode === 101) {
    return { messageId: first.messageId, status: "sent" };
  }

  throw new Error(first?.status || data.SMSMessageData?.Message || "SMS delivery failed");
}
