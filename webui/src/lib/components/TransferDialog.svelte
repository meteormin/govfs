<script lang="ts">
    import { onMount } from "svelte";
    import vfs, { VfsConflictError, type FileInfo } from "../vfs";
    import { appState } from "../state.svelte";
    import { getParentPath, normalizePath, isAncestorOrSame } from "../utils";

    let { file, action, onClose, onComplete }: {
        file: FileInfo;
        action: "copy" | "move";
        onClose: () => void;
        onComplete: () => void;
    } = $props();
    let dialog: HTMLDialogElement;
    let destination = $state("");
    let conflict = $state<FileInfo | null>(null);
    let error = $state("");
    let busy = $state(false);
    const title = $derived(action === "copy" ? "Copy" : "Move");

    onMount(() => {
        destination = file.path.replace(/\/$/, "");
        dialog.showModal();
    });

    async function findConflict(path: string) {
        const siblings = await vfs.list(getParentPath(path));
        return siblings.find((item) => normalizePath(item.path) === path) ?? null;
    }

    async function submit(replace = false) {
        if (busy) return;
        error = "";
        const path = normalizePath(destination.trim());
        const source = normalizePath(file.path);
        if (!path.startsWith("/") || path === "/" || path.includes("\\") ||
            path === source || isAncestorOrSame(path, source) ||
            (file.isDir && isAncestorOrSame(source, path))) {
            error = "Choose a different absolute path outside the source folder.";
            return;
        }
        busy = true;
        try {
            if (!replace) {
                conflict = await findConflict(path);
                if (conflict) return;
            }
            const result = await vfs.transfer(action, file.id, path, replace ? conflict?.id : undefined);
            const current = appState.currentFile;
            if (action === "move" && file.isDir && isAncestorOrSame(source, normalizePath(appState.currentPath))) {
                appState.setCurrentPath(path + normalizePath(appState.currentPath).slice(source.length));
            }
            if (action === "move" && current && isAncestorOrSame(source, normalizePath(current.path))) {
                appState.setCurrentFile(current.id === file.id ? result : {
                    ...current, path: path + normalizePath(current.path).slice(source.length),
                });
            } else if (conflict && current && isAncestorOrSame(path, normalizePath(current.path))) {
                appState.setCurrentFile(null);
            }
            appState.triggerRefreshPath(getParentPath(path));
            onComplete();
            appState.addToast(`${title} completed`, "success");
            onClose();
        } catch (e) {
            if (e instanceof VfsConflictError) {
                try {
                    conflict = await findConflict(path);
                    error = "The destination changed. Review it before trying again.";
                } catch (lookupError) {
                    error = lookupError instanceof Error ? lookupError.message : String(lookupError);
                }
            } else {
                error = e instanceof Error ? e.message : String(e);
            }
        } finally {
            busy = false;
        }
    }
</script>

<dialog bind:this={dialog} aria-label={`${title} ${file.name}`}
    class="m-auto max-h-[90vh] w-full max-w-lg rounded-lg border border-gray-700 bg-gray-900 p-6 text-gray-100 shadow-xl backdrop:bg-black/60"
    onkeydown={(event) => event.stopPropagation()}
    oncancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onsubmit={(event) => { event.preventDefault(); submit(); }}>
        <h2 class="mb-2 text-lg font-semibold">{title} {file.name}</h2>
        <p class="mb-4 break-all text-sm text-gray-400">From: {file.path}</p>
        <label class="block text-sm" for="transfer-destination">Destination path (including name)</label>
        <input id="transfer-destination" class="mt-2 w-full rounded border border-gray-600 bg-gray-800 px-3 py-2"
            bind:value={destination} disabled={busy} required
            oninput={() => { conflict = null; error = ""; }} />
        <p class="mt-2 text-xs text-gray-400">Enter an existing folder and a file or folder name, e.g. /documents/{file.name}</p>
        {#if conflict}
            <div class="mt-4 rounded border border-amber-700 bg-amber-950/40 p-3 text-sm">
                <p class="break-all">{conflict.path} already exists.</p>
                <p class="mt-1">Change the destination name above, or replace the existing {conflict.isDir ? "folder and all its contents" : "file"}. Replacement cannot be undone.</p>
                <button type="button" class="mt-3 rounded bg-red-700 px-3 py-2 disabled:opacity-50"
                    disabled={busy} onclick={() => submit(true)}>Replace</button>
            </div>
        {/if}
        {#if error}<p role="alert" class="mt-3 text-sm text-red-300">{error}</p>{/if}
        <div class="mt-5 flex justify-end gap-3">
            <button type="button" class="rounded px-3 py-2 hover:bg-gray-800" disabled={busy} onclick={onClose}>Cancel</button>
            <button type="submit" class="rounded bg-blue-600 px-4 py-2 disabled:opacity-50" disabled={busy || !!conflict}>
                {busy ? "Working…" : title}
            </button>
        </div>
    </form>
</dialog>
