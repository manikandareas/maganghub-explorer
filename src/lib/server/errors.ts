export class ServiceError extends Error {
  constructor(public code: string, message: string, public status = 503, public retryAfter = 60) {
    super(message);
    this.name = "ServiceError";
  }
}
