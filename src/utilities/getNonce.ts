/**
 * A helper function that returns a unique alphanumeric string.
 *
 * @remarks This function is primarily used to help enforce security in the webview.
 *
 * @returns A nonce string
 */
export function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}