export function errorMessage(status: number, path = "") {
  if (path.includes("payments") && status >= 500) return "Payment service is not currently available.";
  const messages: Record<number, string> = {
    400: "Please check your request.", 401: "Please log in again. Your credentials may be incorrect or your session has expired.",
    402: "You do not have enough credits.", 403: "You do not have permission to perform this action.",
    404: "The requested item was not found.", 409: "This request conflicts with an existing record. Please check your details or refresh.",
    422: "Please check all fields and their allowed lengths.", 429: "Too many requests. Please try again later.",
    502: "The service could not be reached. Please try again later.", 503: "AI service is temporarily unavailable.",
  };
  return messages[status] ?? "Something went wrong. Please try again later.";
}
