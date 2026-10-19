export function errorMessage(status: number, path = "") {
  if (path.includes("/auth/") && status === 503)
    return "Email delivery is unavailable. Please try again later.";
  const messages: Record<number, string> = {
    400: "Please check your request.",
    401: "Please log in again. Your credentials may be incorrect or your session has expired.",
    403: "You do not have permission to perform this action.",
    404: "The requested item was not found.",
    409: "This request conflicts with an existing record. Please check your details or refresh.",
    422: "Please check all fields and their allowed lengths.",
    429: "You've generated several descriptions recently. Please wait a little and try again.",
    502: "The service could not be reached. Please try again later.",
    503: "AI service is temporarily unavailable.",
  };
  return messages[status] ?? "Something went wrong. Please try again later.";
}
