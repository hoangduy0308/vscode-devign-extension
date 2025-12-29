// Define the interface manually since we don't have the types package
interface WebviewApi<State> {
    postMessage(message: unknown): void;
    getState(): State | undefined;
    setState<T extends State>(newState: T): T;
}

declare function acquireVsCodeApi(): WebviewApi<unknown>;

class VSCodeAPIWrapper {
    private readonly vsCodeApi: WebviewApi<unknown> | undefined;

    constructor() {
        // Check if the acquireVsCodeApi function exists in the current window object
        if (typeof acquireVsCodeApi === "function") {
            this.vsCodeApi = acquireVsCodeApi();
        }
    }

    /**
     * Post a message to the extension
     * @param message The message to send to the extension
     */
    public postMessage(message: unknown) {
        if (this.vsCodeApi) {
            this.vsCodeApi.postMessage(message);
        } else {
            console.log("VS Code API not available, message not sent:", message);
        }
    }

    /**
     * Get the persistent state stored for this webview
     * @returns The current state or undefined if no state is stored
     */
    public getState(): unknown | undefined {
        if (this.vsCodeApi) {
            return this.vsCodeApi.getState();
        } else {
            return undefined;
        }
    }

    /**
     * Set the persistent state stored for this webview
     * @param newState The new state to store
     */
    public setState<T>(newState: T): T | undefined {
        if (this.vsCodeApi) {
            this.vsCodeApi.setState(newState);
            return newState;
        } else {
            return undefined;
        }
    }
}

// Export a single instance of the wrapper
export const vscode = new VSCodeAPIWrapper();