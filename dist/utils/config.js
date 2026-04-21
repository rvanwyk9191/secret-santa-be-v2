import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
const ssm = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
/**
 * Fetches a parameter value from AWS SSM Parameter Store.
 * @param name The name of the parameter (with or without leading slash)
 * @param options Optional: { decrypt: boolean }
 */
export async function getConfigParam(name, options) {
    try {
        const command = new GetParameterCommand({
            Name: name,
            WithDecryption: options?.decrypt ?? true,
        });
        const result = await ssm.send(command);
        return result.Parameter?.Value;
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Failed to fetch SSM param: ${name}`, err);
        return undefined;
    }
}
//# sourceMappingURL=config.js.map