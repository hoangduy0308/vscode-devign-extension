/**
 * Keyboard accessibility utilities
 * Provides consistent keyboard interaction patterns across components
 */

/**
 * Handles keyboard activation for interactive elements
 * Supports Enter and Space keys as per WCAG guidelines
 * 
 * @param event - The keyboard event
 * @param callback - The function to call when activated
 * @returns boolean - true if the event was handled
 */
export function handleActivation(
    event: React.KeyboardEvent,
    callback: () => void
): boolean {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        callback();
        return true;
    }
    return false;
}

/**
 * Creates a keyboard event handler for interactive elements
 * Use this to create onKeyDown handlers that support Enter and Space
 * 
 * @param callback - The function to call when activated
 * @returns KeyboardEvent handler function
 */
export function createActivationHandler(
    callback: () => void
): (event: React.KeyboardEvent) => void {
    return (event: React.KeyboardEvent) => {
        handleActivation(event, callback);
    };
}

/**
 * Props for making an element keyboard accessible
 * Spread these onto interactive non-button elements
 */
export interface KeyboardAccessibleProps {
    tabIndex: number;
    role: string;
    onKeyDown: (event: React.KeyboardEvent) => void;
}

/**
 * Creates props for making a clickable element keyboard accessible
 * 
 * @param onClick - The click handler
 * @param role - The ARIA role (default: 'button')
 * @returns Props to spread onto the element
 */
export function makeKeyboardAccessible(
    onClick: () => void,
    role: string = 'button'
): KeyboardAccessibleProps {
    return {
        tabIndex: 0,
        role,
        onKeyDown: createActivationHandler(onClick)
    };
}
