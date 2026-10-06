import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: { role: 'student', username: 'fixture' } }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (selector: (s: typeof state) => unknown) => selector(state) }));
vi.mock('@/components/auth/ProtectedRoute', () => ({ ProtectedRoute: ({children}: {children: unknown}) => children }));
vi.mock('@/components/admin/AdminShell', () => ({ AdminShell: () => 'Admin workspace' }));
vi.mock('@/components/coach/CoachShell', () => ({ CoachShell: () => 'Coach workspace' }));
vi.mock('@/components/account/AccountCenterShell', () => ({ AccountCenterShell: () => 'Player workspace' }));
import RecipeLayout from '@/app/recipes/layout';
describe('shared recipe route preserves authenticated workspace', () => {
  beforeEach(() => { state.user.role = 'student'; });
  it.each([['admin','Admin'],['coach','Coach'],['student','Player'],['user','Player']])('%s uses %s workspace without mutating role', (role, workspace) => {
    state.user.role = role;
    expect(renderToStaticMarkup(createElement(RecipeLayout, null, 'Recipe'))).toBe(`${workspace} workspace`);
    expect(state.user.role).toBe(role);
  });
});
