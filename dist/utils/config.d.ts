/**
 * Fetches a parameter value from AWS SSM Parameter Store.
 * @param name The name of the parameter (with or without leading slash)
 * @param options Optional: { decrypt: boolean }
 */
export declare function getConfigParam(name: string, options?: {
    decrypt?: boolean;
}): Promise<string | undefined>;
//# sourceMappingURL=config.d.ts.map