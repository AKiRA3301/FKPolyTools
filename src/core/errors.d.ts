/**
 * Unified error handling for Polymarket SDK
 */
export declare enum ErrorCode {
    NETWORK_ERROR = "NETWORK_ERROR",
    TIMEOUT = "TIMEOUT",
    RATE_LIMITED = "RATE_LIMITED",
    AUTH_FAILED = "AUTH_FAILED",
    API_KEY_EXPIRED = "API_KEY_EXPIRED",
    INVALID_SIGNATURE = "INVALID_SIGNATURE",
    MARKET_NOT_FOUND = "MARKET_NOT_FOUND",
    WALLET_NOT_FOUND = "WALLET_NOT_FOUND",
    INVALID_RESPONSE = "INVALID_RESPONSE",
    INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
    ORDER_REJECTED = "ORDER_REJECTED",
    ORDER_FAILED = "ORDER_FAILED",
    MARKET_CLOSED = "MARKET_CLOSED",
    API_ERROR = "API_ERROR",
    INTERNAL_ERROR = "INTERNAL_ERROR"
}
export declare class PolymarketError extends Error {
    code: ErrorCode;
    retryable: boolean;
    originalError?: Error | undefined;
    constructor(code: ErrorCode, message: string, retryable?: boolean, originalError?: Error | undefined);
    /**
     * Create error from HTTP response status
     */
    static fromHttpError(status: number, body?: unknown): PolymarketError;
}
/**
 * Retry decorator for async functions
 */
export declare function withRetry<T>(fn: () => Promise<T>, options?: {
    maxRetries?: number;
    delay?: number;
}): Promise<T>;
