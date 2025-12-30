import './vscode-mock'; // Must be first
import * as assert from 'assert';
import { GitHubAuthService, getGitHubAuthService, GitHubScopes } from '../../services/githubAuthService';

suite('GitHubAuthService Test Suite', () => {
    let authService: GitHubAuthService;

    setup(() => {
        // Get fresh instance for each test
        // Note: In real tests, we'd reset the singleton between tests
        authService = GitHubAuthService.getInstance();
    });

    suite('Singleton Pattern', () => {
        test('getInstance returns the same instance', () => {
            const instance1 = GitHubAuthService.getInstance();
            const instance2 = GitHubAuthService.getInstance();
            assert.strictEqual(instance1, instance2, 'Should return the same singleton instance');
        });

        test('getGitHubAuthService returns singleton', () => {
            const instance1 = getGitHubAuthService();
            const instance2 = GitHubAuthService.getInstance();
            assert.strictEqual(instance1, instance2, 'Helper function should return singleton');
        });
    });

    suite('getCurrentUser', () => {
        test('returns null when no session is cached', () => {
            // Without calling getSession first, currentSession should be null
            // Note: We can't easily test with a session without mocking vscode.authentication
            const user = authService.getCurrentUser();
            // The user will be null since we haven't authenticated
            assert.strictEqual(user, null, 'Should return null when no cached session');
        });
    });

    suite('GitHubScopes Constants', () => {
        test('USER_READ scope is defined', () => {
            assert.strictEqual(GitHubScopes.USER_READ, 'read:user');
        });

        test('USER_EMAIL scope is defined', () => {
            assert.strictEqual(GitHubScopes.USER_EMAIL, 'user:email');
        });

        test('REPO scope is defined', () => {
            assert.strictEqual(GitHubScopes.REPO, 'repo');
        });

        test('REPO_READ scope is defined', () => {
            assert.strictEqual(GitHubScopes.REPO_READ, 'public_repo');
        });
    });

    // Note: Testing isAuthenticated(), getSession(), signIn(), etc. requires
    // mocking vscode.authentication.getSession which returns AuthenticationSession.
    // This would require a more sophisticated mock setup or a library like sinon.
    // For now, we test the synchronous/pure functionality above.

    // TODO: Add these tests when vscode-mock is enhanced:
    // - test isAuthenticated returns true when session exists
    // - test getSessionSilent returns session without prompting
    // - test getSessionInteractive prompts for sign-in
    // - test signOut clears cached session
    // - test hasScopes checks for required scopes
    // - test ensureScopes requests additional scopes
});
