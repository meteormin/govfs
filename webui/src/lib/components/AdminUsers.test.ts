import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, expect, it, vi } from 'vitest';
import AdminUsers from './AdminUsers.svelte';

afterEach(() => vi.unstubAllGlobals());

it('toggles user details and all activity without fetching on collapse', async () => {
    const fetch = vi.fn(async (path: string) => ({
        ok: true,
        json: async () => path === '/admin/users'
            ? [{ id: 'user-1', username: 'alice', role: 'user', disabled: false }]
            : path.includes('/status')
                ? { items: 3, size: 1024, open: true, online: false, sseCount: 0 }
                : { items: [], page: 1, total: 0 },
    }));
    vi.stubGlobal('fetch', fetch);
    render(AdminUsers);
    const details = await screen.findByRole('button', { name: 'Details' });
    await fireEvent.click(details);
    expect(await screen.findByText('1.00 KiB')).toBeInTheDocument();
    expect(details).toHaveAttribute('aria-expanded', 'true');
    const calls = fetch.mock.calls.length;
    await fireEvent.click(details);
    expect(screen.queryByText('alice details')).not.toBeInTheDocument();
    expect(screen.queryByText('alice activity')).not.toBeInTheDocument();
    expect(details).toHaveAttribute('aria-expanded', 'false');
    expect(fetch).toHaveBeenCalledTimes(calls);
    await fireEvent.click(details);
    expect(await screen.findByText('alice details')).toBeInTheDocument();
    const all = screen.getByRole('button', { name: 'All activity' });
    await fireEvent.click(all);
    expect(all).toHaveAttribute('aria-expanded', 'true');
    await fireEvent.click(all);
    expect(all).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('heading', { name: 'All activity' })).not.toBeInTheDocument();
});
