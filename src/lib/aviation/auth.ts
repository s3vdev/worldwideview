import { initCredentialPool, getActiveCredential, fetchTokenForCredential } from "./credentials";

/**
 * Get an OAuth2 access token for the currently active OpenSky credential.
 * Initialises the credential pool on first call.
 */
export async function getOpenSkyAccessToken(): Promise<string | null> {
    initCredentialPool();
    const cred = getActiveCredential();
    if (!cred) return null;
    return fetchTokenForCredential(cred);
}
