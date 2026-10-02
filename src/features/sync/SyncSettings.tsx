/**
 * Settings → Account & Sync. Loaded when it is opened; it then loads the engine. Nothing here
 * runs for someone who never opens this screen and never turns sync on.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { downloadText } from '../../app/actions';
import { loadDeviceLocal } from '../../storage/deviceLocal';
import { app, useStore } from '../../storage/store';
import { SYNC } from '../../sync/config';
import type { DeviceInfo, Status } from '../../sync/engine';
import type { Conflict, Resolutions, Side } from '../../sync/merge';
import { syncRuntime, type Runtime } from '../../sync/syncRuntime';
import { backgroundStatus, type BackgroundStatus } from '../../sync/wallpaper';
import './sync.css';
import { st, type SyncKey } from './text';

const when = (time: number | undefined): string => (time ? new Date(time).toLocaleString(app.get().prefs.language, { dateStyle: 'medium', timeStyle: 'short' }) : st('never'));

function Row({ label, hint, children }: { label: string; hint?: string; children?: ComponentChildren }) {
    return (
        <div class="row">
            <div class="row-text">
                <span class="row-label">{label}</span>
                {hint && <span class="row-hint">{hint}</span>}
            </div>
            <div class="row-control">{children}</div>
        </div>
    );
}

/** A button that asks once more, in place, before doing something that cannot be undone here. */
function Confirmed({ label, confirm, danger, onConfirm }: { label: string; confirm: string; danger?: boolean; onConfirm: () => void }) {
    const [asking, setAsking] = useState(false);
    if (!asking) return <button type="button" class="button" onClick={() => setAsking(true)}>{label}</button>;
    return (
        <>
            <button type="button" class={`button ${danger ? 'is-danger' : 'is-primary'}`} onClick={() => {
                setAsking(false);
                onConfirm();
            }}>{confirm}</button>
            <button type="button" class="button" onClick={() => setAsking(false)}>{st('cancel')}</button>
        </>
    );
}

// ---------- Signed out ----------

function SignedOut({ runtime, status }: { runtime: Runtime; status: Status }) {
    return (
        <>
            {status.error === 'removed' && <p class="note sync-notice" role="status">{st('out.removed')}</p>}
            <p class="note">{st('out.lede')}</p>
            <ul class="sync-facts">
                {(['out.what', 'out.signin', 'out.encrypted', 'out.local', 'out.visible', 'out.analytics'] as const).map(key => <li key={key}>{st(key)}</li>)}
            </ul>
            <button type="button" class="button is-primary" data-sync="sign-in" onClick={() => void runtime.engine.signIn()}>{st('out.action')}</button>
        </>
    );
}

// ---------- Creating the vault: the recovery key, shown once ----------

function NewVault({ runtime, recoveryKey }: { runtime: Runtime; recoveryKey: string }) {
    const [typed, setTyped] = useState('');
    const [copied, setCopied] = useState(false);
    const matches = typed.trim().toUpperCase() === recoveryKey.slice(-4);
    return (
        <>
            <h4>{st('new.title')}</h4>
            <p class="note">{st('new.body')}</p>
            <code class="sync-key" data-sync="recovery-key">{recoveryKey}</code>
            <div class="sync-actions">
                <button type="button" class="button" onClick={() => void navigator.clipboard.writeText(recoveryKey).then(() => setCopied(true))}>{copied ? st('new.copied') : st('new.copy')}</button>
                <button type="button" class="button" onClick={() => downloadText(`Senuma recovery key\n\n${recoveryKey}\n`, 'senuma-recovery-key.txt')}>{st('new.download')}</button>
            </div>
            <p class="note sync-notice">{st('new.warning')}</p>
            <label class="field">
                <span>{st('new.confirmLabel')}</span>
                <input type="text" value={typed} maxLength={8} autocomplete="off" spellcheck={false} data-sync="confirm-key" onInput={event => setTyped(event.currentTarget.value)} />
            </label>
            <div class="sync-actions">
                <button type="button" class="button is-primary" disabled={!matches} data-sync="confirm-vault" onClick={() => void runtime.engine.confirmNewVault()}>{st('new.confirm')}</button>
                <button type="button" class="button" onClick={() => void runtime.engine.signOut()}>{st('new.cancel')}</button>
            </div>
            <p class="note">{st('new.nothingYet')}</p>
        </>
    );
}

// ---------- Joining: the recovery key, entered ----------

function NeedsKey({ runtime, changed }: { runtime: Runtime; changed: boolean }) {
    const [typed, setTyped] = useState('');
    const [invalid, setInvalid] = useState(false);
    const [lost, setLost] = useState(false);
    const [busy, setBusy] = useState(false);
    if (lost) {
        return (
            <>
                <h4>{st('lost.title')}</h4>
                <p class="note">{st('lost.body')}</p>
                <p class="note">{st('lost.option')}</p>
                <div class="sync-actions">
                    <Confirmed label={st('lost.action')} confirm={st('delete.confirm')} danger
                        onConfirm={() => void runtime.engine.deleteCloudData().then(() => runtime.engine.signIn())} />
                    <button type="button" class="button" onClick={() => setLost(false)}>{st('lost.back')}</button>
                </div>
            </>
        );
    }
    const unlock = async (event: Event) => {
        event.preventDefault();
        setBusy(true);
        setInvalid(!(await runtime.engine.unlock(typed)));
        setBusy(false);
    };
    return (
        <form onSubmit={event => void unlock(event)}>
            <h4>{st('key.title')}</h4>
            <p class="note">{changed ? st('key.changed') : st('key.body')}</p>
            <label class="field">
                <input type="text" class="sync-key-input" value={typed} placeholder={st('key.placeholder')} autocomplete="off" spellcheck={false} aria-invalid={invalid} data-sync="enter-key"
                    onInput={event => {
                        setTyped(event.currentTarget.value);
                        setInvalid(false);
                    }} />
                {invalid && <span class="field-error" role="alert">{st('key.invalid')}</span>}
            </label>
            <div class="sync-actions">
                <button type="submit" class="button is-primary" disabled={busy || !typed.trim()} data-sync="unlock">{st('key.action')}</button>
                <button type="button" class="text-button" onClick={() => setLost(true)}>{st('key.lost')}</button>
                <button type="button" class="button" onClick={() => void runtime.engine.signOut()}>{st('do.signOut')}</button>
            </div>
        </form>
    );
}

// ---------- First sync: two setups with no common past ----------

function FirstSync({ runtime, status }: { runtime: Runtime; status: Status }) {
    const sides = status.firstSync!;
    const choice = (kind: 'merge' | 'cloud' | 'device', title: SyncKey, hint: SyncKey) => (
        <button type="button" class="choice" data-sync={`first-${kind}`} onClick={() => void runtime.engine.resolveFirstSync(kind)}>
            <strong>{st(title)}</strong>
            <span>{st(hint)}</span>
        </button>
    );
    return (
        <>
            <h4>{st('first.title')}</h4>
            <p class="note">{st('first.body', { cs: sides.cloud.spaces, cl: sides.cloud.links, ds: sides.device.spaces, dl: sides.device.links })}</p>
            <div class="choice-row">
                {choice('merge', 'first.merge', 'first.mergeHint')}
                {choice('cloud', 'first.cloud', 'first.cloudHint')}
                {choice('device', 'first.device', 'first.deviceHint')}
            </div>
        </>
    );
}

// ---------- Conflicts ----------

/** What a conflict is about, in the person's own words for it. */
function describe(conflict: Conflict): string {
    const state = app.get();
    const name = conflict.kind === 'item' ? state.items[conflict.id]?.title
        : conflict.kind === 'space' ? state.spaces[conflict.id]?.name
            : conflict.kind === 'group' ? Object.values(state.spaces).flatMap(space => space.groups).find(group => group.id === conflict.id)?.name
                : conflict.kind === 'mode' ? state.modes[conflict.id.split(':')[0]!]?.name : undefined;
    const what = st(`conflict.of.${conflict.kind}` as SyncKey, { name: name || '…' });
    const field = conflict.field === 'exists' || conflict.field === 'order' || conflict.field === 'group' ? st(`conflict.field.${conflict.field}` as SyncKey) : conflict.field === 'value' ? conflict.id : conflict.field;
    return `${what} · ${field}`;
}

function shown(conflict: Conflict, value: unknown): string {
    if (conflict.field === 'order') return st('conflict.order');
    if (value === null || value === undefined) return conflict.field === 'exists' ? st('conflict.deleted') : st('conflict.none');
    if (conflict.field === 'exists') return typeof (value as { title?: unknown }).title === 'string' ? (value as { title: string }).title : typeof (value as { name?: unknown }).name === 'string' ? (value as { name: string }).name : '✓';
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

function Conflicts({ runtime, status }: { runtime: Runtime; status: Status }) {
    const conflicts = status.conflicts ?? [];
    const [picked, setPicked] = useState<Resolutions>({});
    const all = conflicts.every(conflict => picked[conflict.key]);
    const side = (conflict: Conflict, which: Side, label: SyncKey, value: unknown) => (
        <label class={`sync-side${picked[conflict.key] === which ? ' is-picked' : ''}`}>
            <input type="radio" name={conflict.key} checked={picked[conflict.key] === which} onChange={() => setPicked({ ...picked, [conflict.key]: which })} />
            <span class="sync-side-label">{st(label)}</span>
            <span class="sync-side-value">{shown(conflict, value)}</span>
        </label>
    );
    return (
        <div data-sync="conflicts">
            <h4>{st('conflict.title', { n: conflicts.length })}</h4>
            <p class="note">{st('conflict.body')}</p>
            <ul class="sync-conflicts">
                {conflicts.map(conflict => (
                    <li key={conflict.key}>
                        <span class="sync-conflict-name">{describe(conflict)}</span>
                        {side(conflict, 'local', 'conflict.local', conflict.local)}
                        {side(conflict, 'remote', 'conflict.cloud', conflict.remote)}
                    </li>
                ))}
            </ul>
            <div class="sync-actions">
                <button type="button" class="button is-primary" disabled={!all} data-sync="apply-choices" onClick={() => void runtime.engine.resolveConflicts(picked)}>{st('conflict.apply')}</button>
                <button type="button" class="button" data-sync="keep-local" onClick={() => void runtime.engine.resolveConflicts('local')}>{st('conflict.keepLocal')}</button>
                <button type="button" class="button" data-sync="keep-cloud" onClick={() => void runtime.engine.resolveConflicts('remote')}>{st('conflict.keepCloud')}</button>
                <button type="button" class="button" disabled={!status.canKeepBoth} title={status.canKeepBoth ? st('conflict.keepBothHint') : st('conflict.keepBothNo')} data-sync="keep-both"
                    onClick={() => void runtime.engine.resolveConflicts('both')}>{st('conflict.keepBoth')}</button>
            </div>
            <p class="note">{status.canKeepBoth ? st('conflict.keepBothHint') : st('conflict.keepBothNo')}</p>
        </div>
    );
}

// ---------- Signed in ----------

function Devices({ runtime, status }: { runtime: Runtime; status: Status }) {
    const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
    const load = () => void runtime.engine.devices().then(setDevices).catch(() => setDevices([]));
    useEffect(load, [status.lastSyncAt, status.phase]);
    if (!devices?.length) return null;
    return (
        <>
            <h4>{st('devices.title')}</h4>
            <ul class="list" data-sync="devices">
                {devices.map(device => (
                    <li class="list-row" key={device.id}>
                        <span class="list-name">
                            {device.thisDevice
                                ? <input class="sync-device-name" value={device.label} maxLength={60} aria-label={st('devices.rename')} onChange={event => void runtime.engine.renameDevice(event.currentTarget.value).then(load)} />
                                : device.readable ? device.label : st('devices.unreadable')}
                            <span class="list-sub">{device.thisDevice ? `${st('devices.this')} · ` : ''}{st('devices.last', { when: when(device.lastSyncAt) })}</span>
                        </span>
                        {!device.thisDevice && <Confirmed label={st('devices.remove')} confirm={st('devices.remove')} danger onConfirm={() => void runtime.engine.removeDevice(device.id).then(load)} />}
                    </li>
                ))}
            </ul>
            <p class="note">{st('devices.removeHint')}</p>
        </>
    );
}

function RecoveryKey({ runtime }: { runtime: Runtime }) {
    const [key, setKey] = useState<string | null>(null);
    const [fresh, setFresh] = useState(false);
    return (
        <>
            <Row label={st('recovery.title')} hint={key ? undefined : st('recovery.hint')}>
                {key
                    ? <button type="button" class="button" onClick={() => setKey(null)}>{st('recovery.hide')}</button>
                    : <Confirmed label={st('recovery.show')} confirm={st('recovery.yes')} onConfirm={() => void runtime.engine.recoveryKey().then(setKey)} />}
            </Row>
            {!key && <p class="note">{st('recovery.confirm')}</p>}
            {key && <code class="sync-key" data-sync="recovery-key">{key}</code>}
            {key && fresh && <p class="note sync-notice">{st('new.warning')}</p>}
            <Row label={st('recovery.new')} hint={st('recovery.newHint')}>
                <Confirmed label={st('recovery.new')} confirm={st('recovery.newConfirm')} onConfirm={() => void runtime.engine.newRecoveryKey().then(next => {
                    if (!next) return;
                    setKey(next);
                    setFresh(true);
                })} />
            </Row>
        </>
    );
}

function SignedIn({ runtime, status }: { runtime: Runtime; status: Status }) {
    const state = useStore(app);
    const [backgrounds, setBackgrounds] = useState<BackgroundStatus[]>([]);
    useEffect(() => {
        void loadDeviceLocal(state).then(device => setBackgrounds(backgroundStatus(state, device)));
    }, [status.lastSyncAt, state.prefs.background]);
    const error = status.phase === 'error' ? status.error ?? 'failed' : null;
    const line = status.phase === 'error' ? st('state.error') : st(`state.${status.phase}` as SyncKey);
    return (
        <>
            <p class="sync-state" data-sync="state" data-phase={status.phase} role="status">{line}</p>
            <p class="note">{st('account', { email: status.account ?? '' })} · {st('last', { when: when(status.lastSyncAt) })}</p>
            {error && <p class="note sync-notice" role="alert" data-sync="error" data-error={error}>{st(`err.${error}` as SyncKey)}</p>}
            {status.nearLimit && <p class="note sync-notice">{st('nearLimit')}</p>}
            {backgrounds.map(entry => <p class="note sync-notice" key={entry.slot} data-sync="background-notice">{st(entry.deviceChoice ? 'bg.own' : 'bg.missing')}</p>)}

            <div class="sync-actions">
                {error === 'auth-expired'
                    ? <button type="button" class="button is-primary" data-sync="sign-in-again" onClick={() => void runtime.engine.reauthenticate()}>{st('do.signInAgain')}</button>
                    : error === 'missing'
                        ? <button type="button" class="button is-primary" data-sync="upload-again" onClick={() => void runtime.engine.uploadAgain()}>{st('err.missingAction')}</button>
                        : <button type="button" class="button is-primary" disabled={status.phase === 'syncing' || status.phase === 'paused'} data-sync="sync-now" onClick={() => void runtime.syncNow()}>{error ? st('do.retry') : st('do.sync')}</button>}
                {status.phase === 'paused'
                    ? <button type="button" class="button" data-sync="resume" onClick={() => void runtime.engine.resume()}>{st('do.resume')}</button>
                    : <button type="button" class="button" data-sync="pause" onClick={() => void runtime.engine.pause()}>{st('do.pause')}</button>}
            </div>

            {status.phase === 'conflict' && <Conflicts runtime={runtime} status={status} />}
            {!error && status.phase !== 'offline' && <Devices runtime={runtime} status={status} />}
            {!error && <RecoveryKey runtime={runtime} />}

            <Row label={st('do.signOut')} hint={st('do.signOutHint')}>
                <button type="button" class="button" data-sync="sign-out" onClick={() => void runtime.engine.signOut()}>{st('do.signOut')}</button>
            </Row>
            <Row label={st('delete.title')} hint={st('delete.hint')}>
                <Confirmed label={st('delete.title')} confirm={st('delete.confirm')} danger onConfirm={() => void runtime.engine.deleteCloudData()} />
            </Row>
        </>
    );
}

export function SyncSettings() {
    const [runtime, setRuntime] = useState<Runtime | null>(null);
    const [status, setStatus] = useState<Status | null>(null);
    useEffect(() => {
        let stop = () => undefined as void;
        void syncRuntime().then(loaded => {
            setRuntime(loaded);
            setStatus(loaded.engine.status());
            const unsubscribe = loaded.engine.subscribe(setStatus);
            stop = () => void unsubscribe();
        });
        return () => stop();
    }, []);
    return (
        <div class="sync" data-sync="root" data-phase={status?.phase ?? 'loading'}>
            <h3>{st('title')}</h3>
            {SYNC?.mock && <p class="note sync-notice">{st('testBuild')}</p>}
            {runtime && status && (
                status.phase === 'signed-out' ? <SignedOut runtime={runtime} status={status} />
                    : status.phase === 'connecting' ? <p class="note" role="status">{st('connecting')}</p>
                        : status.phase === 'new-vault' ? <NewVault runtime={runtime} recoveryKey={status.recoveryKey ?? ''} />
                            : status.phase === 'needs-key' ? <NeedsKey runtime={runtime} changed={!!status.lastSyncAt} />
                                : status.phase === 'first-sync' ? <FirstSync runtime={runtime} status={status} />
                                    : <SignedIn runtime={runtime} status={status} />
            )}
        </div>
    );
}
