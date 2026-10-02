/**
 * The device-local record: what this device must remember that is not part of the setup and is
 * never uploaded (Senuma 2.1; read and written only by sync, which does not exist yet).
 *
 * It lives under its own storage key, beside the setup rather than inside it, so it cannot
 * reach a synced copy, a backup file or a restore point by any path that handles the setup.
 */
import { STORAGE_KEYS } from '../brand';
import { kv } from '../browser/kv';
import type { AppState } from '../core/types';
import { sanitizeDeviceLocal, type DeviceLocal } from '../sync/wallpaper';

export async function loadDeviceLocal(state: AppState): Promise<DeviceLocal> {
    return sanitizeDeviceLocal((await kv.get([STORAGE_KEYS.device]))[STORAGE_KEYS.device], state);
}

/** Rejects when the write fails. */
export async function saveDeviceLocal(device: DeviceLocal): Promise<void> {
    await kv.set({ [STORAGE_KEYS.device]: device });
}
