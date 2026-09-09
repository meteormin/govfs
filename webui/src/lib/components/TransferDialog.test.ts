import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, expect, it, vi } from 'vitest';
import TransferDialog from './TransferDialog.svelte';
import vfs, { VfsConflictError } from '../vfs';

vi.mock('../vfs', () => ({
    default: { list: vi.fn(), transfer: vi.fn(), stat: vi.fn() },
    VfsConflictError: class extends Error {},
}));

const file = { id: 'source', name: 'a.txt', path: '/a.txt', isDir: false, size: 1, modified: '', comments: '', extension: 'txt' };
const target = { ...file, id: 'target', name: 'b.txt', path: '/b.txt' };
beforeEach(() => {
    vi.resetAllMocks();
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    vi.mocked(vfs.list).mockResolvedValue([]);
    vi.mocked(vfs.transfer).mockResolvedValue(target);
});

async function open(action: 'copy' | 'move' = 'copy') {
    const onClose = vi.fn();
    render(TransferDialog, { file, action, onClose, onComplete: vi.fn() });
    await fireEvent.input(screen.getByLabelText('Destination path (including name)'), { target: { value: '/b.txt' } });
    return onClose;
}

it('requires explicit replacement and sends the confirmed target ID', async () => {
    vi.mocked(vfs.list).mockResolvedValue([target]);
    const close = await open();
    await fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(vfs.transfer).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(vfs.transfer).toHaveBeenCalledWith('copy', 'source', '/b.txt', 'target');
});

it('clears replacement approval when the destination name changes', async () => {
    vi.mocked(vfs.list).mockResolvedValueOnce([target]).mockResolvedValue([]);
    await open('move');
    await fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    await screen.findByRole('button', { name: 'Replace' });
    await fireEvent.input(screen.getByLabelText('Destination path (including name)'), { target: { value: '/c.txt' } });
    expect(screen.queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(vfs.transfer).toHaveBeenCalledWith('move', 'source', '/c.txt', undefined));
});

it('asks again when a target appears after the preflight check', async () => {
    vi.mocked(vfs.list).mockResolvedValueOnce([]).mockResolvedValueOnce([target]);
    vi.mocked(vfs.transfer).mockRejectedValueOnce(new VfsConflictError());
    const close = await open();
    await fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    expect(vfs.transfer).toHaveBeenCalledTimes(1);
});

it('does not modify anything when cancelled or the source path is chosen', async () => {
    const close = await open();
    await fireEvent.input(screen.getByLabelText('Destination path (including name)'), { target: { value: '/a.txt' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(vfs.transfer).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(close).toHaveBeenCalled();
});

it('keeps dialog keyboard input out of the file tree shortcuts', async () => {
    await open();
    const listener = vi.fn();
    document.addEventListener('keydown', listener);
    try {
        await fireEvent.keyDown(screen.getByLabelText('Destination path (including name)'), { key: 'Delete' });
        expect(listener).not.toHaveBeenCalled();
    } finally {
        document.removeEventListener('keydown', listener);
    }
});
