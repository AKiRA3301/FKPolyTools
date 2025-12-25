/**
 * Unified error handling for Polymarket SDK
 */
export var ErrorCode;
(function (ErrorCode) {
    // Network errors
    ErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorCode["TIMEOUT"] = "TIMEOUT";
    ErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    // Authentication errors
    ErrorCode["AUTH_FAILED"] = "AUTH_FAILED";
    ErrorCode["API_KEY_EXPIRED"] = "API_KEY_EXPIRED";
    ErrorCode["INVALID_SIGNATURE"] = "INVALID_SIGNATURE";
    // Data errors
    ErrorCode["MARKET_NOT_FOUND"] = "MARKET_NOT_FOUND";
    ErrorCode["WALLET_NOT_FOUND"] = "WALLET_NOT_FOUND";
    ErrorCode["INVALID_RESPONSE"] = "INVALID_RESPONSE";
    // Trading errors
    ErrorCode["INSUFFICIENT_BALANCE"] = "INSUFFICIENT_BALANCE";
    ErrorCode["ORDER_REJECTED"] = "ORDER_REJECTED";
    ErrorCode["ORDER_FAILED"] = "ORDER_FAILED";
    ErrorCode["MARKET_CLOSED"] = "MARKET_CLOSED";
    // API errors
    ErrorCode["API_ERROR"] = "API_ERROR";
    // Internal errors
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
})(ErrorCode || (ErrorCode = {}));
export class PolymarketError extends Error {
    code;
    retryable;
    originalError;
    constructor(code, message, retryable = false, originalError) {
        super(message);
        this.code = code;
        this.retryable = retryable;
        this.originalError = originalError;
        this.name = 'PolymarketError';
    }
    /**
     * Create error from HTTP response status
     */
    static fromHttpError(status, body) {
        const bodyMessage = body && typeof body === 'object' && 'message' in body
            ? String(body.message)
            : '';
        switch (status) {
            case 429:
                return new PolymarketError(ErrorCode.RATE_LIMITED, bodyMessage || 'Rate limited', true);
            case 401:
                return new PolymarketError(ErrorCode.AUTH_FAILED, bodyMessage || 'Authentication failed');
            case 403:
                return new PolymarketError(ErrorCode.AUTH_FAILED, bodyMessage || 'Forbidden');
            case 404:
                return new PolymarketError(ErrorCode.MARKET_NOT_FOUND, bodyMessage || 'Resource not found');
            case 400:
                return new PolymarketError(ErrorCode.INVALID_RESPONSE, bodyMessage || 'Bad request');
            default:
                return new PolymarketError(ErrorCode.NETWORK_ERROR, bodyMessage || `HTTP ${status}`, status >= 500);
        }
    }
}
/**
 * Retry decorator for async functions
 */
export async function withRetry(fn, options = {}) {
    const { maxRetries = 3, delay = 1000 } = options;
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (error instanceof PolymarketError && !error.retryable) {
                throw error;
            }
            if (i < maxRetries - 1) {
                await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
            }
        }
    }
    throw lastError;
}
