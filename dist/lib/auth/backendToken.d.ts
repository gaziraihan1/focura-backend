export declare const BACKEND_TOKEN_EXPIRY = "15m";
export declare function createBackendToken(payload: {
    id: string;
    email: string;
    role?: string;
}): string;
