# Contributing to Devign VS Code Extension

Thank you for your interest in contributing to the Devign VS Code Extension! We welcome contributions from the community to help improve this tool for everyone.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please treat everyone with respect and kindness.

## How to Contribute

### Reporting Bugs

If you find a bug, please create a new issue in the [issue tracker](https://github.com/hoangduy0308/vscode-devign-extension/issues). Include as much detail as possible:
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Screenshots or logs (if applicable)
- Your environment (OS, VS Code version, Extension version)

### Suggesting Enhancements

We love hearing about new ideas! If you have a suggestion for a feature or improvement, please open an issue and describe:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### Pull Requests

1.  **Fork the repository** and create your branch from `main`.
2.  **Install dependencies**:
    ```bash
    npm install
    cd webview-ui
    npm install
    cd ..
    ```
3.  **Make your changes**. Ensure your code follows the existing style and conventions.
4.  **Run tests** (if available) to ensure no regressions.
5.  **Commit your changes** with clear and descriptive commit messages.
6.  **Push to your fork** and submit a Pull Request to the `main` branch.
7.  **Describe your changes** in the PR description, linking to any relevant issues.

## Development Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/hoangduy0308/vscode-devign-extension.git
    ```
2.  Open the project in VS Code.
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Compile the extension:
    ```bash
    npm run compile
    ```
5.  Press `F5` to launch the Extension Development Host and test your changes.

## Project Structure

-   `src/`: Extension source code (TypeScript)
-   `webview-ui/`: React application for the webview UI
-   `python/`: Python scripts for the backend model and scanning
-   `media/`: Icons and images
-   `resources/`: Static resources

## Coding Guidelines

-   Use TypeScript for extension code.
-   Use React for UI components.
-   Follow the existing linting and formatting rules.

Thank you for contributing!