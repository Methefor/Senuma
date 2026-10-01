import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { commitAppearance, savedAppearance, type Appearance } from '../../app/appearance';
import { ensureSnapshots } from '../../app/actions';
import { deleteWallpaper, listWallpaperIds, putWallpaper, wallpaperUrl } from '../../browser/assets';
import {
    ATMOSPHERE_LEVELS, BACKGROUND_LIMITS, DEFAULT_BACKGROUND, MAX_WALLPAPERS, WALLPAPER_PHOTOS, WALLPAPER_PRESETS,
    betterThemesFor, pictureMood, presetById, sourceKey, suggestedDim,
    type Background, type BackgroundSource, type WallpaperAsset,
} from '../../core/background';
import { newId } from '../../core/defaults';
import { activeMode, addWallpaper, removeWallpaper, updateMode } from '../../core/ops';
import { themeById } from '../../core/themes';
import type { AppState, MotionLevel } from '../../core/types';
import { t, type MessageKey } from '../../i18n';
import { app, setUi, toast, ui, update, useStore } from '../../storage/store';
import { Icon } from '../../ui/Icon';
import { Overlay } from '../../ui/Overlay';
import { photoUrl } from '../background/photos';
import { ACCEPTED_IMAGE_TYPES, processImage } from '../background/processImage';
import { ThemePicker } from './ThemePicker';

const MOTION_LEVELS: readonly MotionLevel[] = ['full', 'reduced', 'off'];
const POSITIONS = [0, 50, 100] as const;
const SOLID_DEFAULT = '#14161f';
const GRADIENT_DEFAULT = { from: '#1b2440', to: '#3a1f3d', angle: 160 };

function Segmented<T extends string>({ label, value, options, labelFor, onChange }: {
    label: string;
    value: T;
    options: readonly T[];
    labelFor: (option: T) => string;
    onChange: (option: T) => void;
}) {
    return (
        <div class="segmented" role="radiogroup" aria-label={label}>
            {options.map(option => (
                <button type="button" key={option} role="radio" aria-checked={option === value} onClick={() => onChange(option)}>
                    {labelFor(option)}
                </button>
            ))}
        </div>
    );
}

function Slider({ label, value, max, step, onChange }: { label: string; value: number; max: number; step: number; onChange: (value: number) => void }) {
    return (
        <label class="slider">
            <span>{label}</span>
            <input type="range" min={0} max={max} step={step} value={value} onInput={event => onChange(Number(event.currentTarget.value))} />
        </label>
    );
}

function Tile({ source, name, current, onChoose, style, children }: {
    source: BackgroundSource;
    name: string;
    /** sourceKey of the background currently in the draft. */
    current: string;
    onChoose: (source: BackgroundSource) => void;
    style?: Record<string, string | undefined>;
    children?: ComponentChildren;
}) {
    return (
        <button type="button" class="swatch-tile" role="radio" aria-checked={sourceKey(source) === current} title={name} aria-label={name}
            onClick={() => onChoose(source)}>
            {children ?? <span class="swatch-fill" style={style} />}
        </button>
    );
}

/** A thumbnail read from local storage; shows the image's stored colour until it arrives. */
function UploadThumb({ asset }: { asset: WallpaperAsset }) {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        let live = true;
        void wallpaperUrl(asset.id, 'thumb').then(result => live && setUrl(result));
        return () => {
            live = false;
        };
    }, [asset.id]);
    return <span class="swatch-fill" style={{ backgroundColor: asset.color, backgroundImage: url ? `url(${url})` : asset.lqip ? `url(${asset.lqip})` : undefined }} />;
}

function BackgroundSection({ state, draft, onChange, onTheme }: {
    state: AppState;
    draft: Appearance;
    onChange: (background: Background) => void;
    /** Tries a suggested theme, with the picture's wash recalculated for it. */
    onTheme: (themeId: string, background: Background) => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState<string | null>(null);
    const [advanced, setAdvanced] = useState(false);
    const background = draft.background;
    const current = sourceKey(background.source);
    const scheme = themeById(draft.themeId).scheme;
    const assets = Object.values(state.wallpapers).sort((a, b) => b.createdAt - a.createdAt);
    const full = assets.length >= MAX_WALLPAPERS;

    /** Picking a picture also picks a wash that keeps text readable over it. */
    const pick = (luminance?: number, curated = false) => (source: BackgroundSource) =>
        onChange({ ...background, source, ...(luminance === undefined ? {} : { dim: suggestedDim(luminance, scheme, curated) }) });

    const add = async (file: File | undefined) => {
        if (!file) return;
        setBusy(true);
        const processed = await processImage(file);
        if (!processed.ok) {
            setBusy(false);
            return toast(t(`background.error.${processed.reason}` as MessageKey));
        }
        const id = newId();
        const stored = await putWallpaper(id, processed.full, processed.thumb);
        setBusy(false);
        if (!stored.ok) return toast(t('background.error.storage'));
        // The library is saved straight away (the file is already on disk); using the
        // picture as the background is still only a preview until Apply.
        update(s => addWallpaper(s, { ...processed.meta, id, createdAt: Date.now() }));
        onChange({ ...DEFAULT_BACKGROUND, source: { kind: 'upload', assetId: id }, dim: suggestedDim(processed.meta.luminance, scheme) });
    };

    const remove = (id: string) => {
        setConfirming(null);
        if (background.source.kind === 'upload' && background.source.assetId === id) onChange({ ...background, source: DEFAULT_BACKGROUND.source });
        update(s => removeWallpaper(s, id));
        void deleteWallpaper(id);
    };

    const isPicture = background.source.kind !== 'theme';
    const chosenPreset = background.source.kind === 'preset' ? presetById(background.source.id) : undefined;
    const placeable = background.source.kind === 'upload' || !!chosenPreset?.file;
    // A picture that fights the theme gets a suggestion. The theme is never changed for the user.
    const luminance = background.source.kind === 'upload' ? state.wallpapers[background.source.assetId]?.luminance : chosenPreset?.luminance;
    const better = luminance === undefined ? [] : betterThemesFor(luminance, scheme);

    return (
        <section class="customize-section">
            <h3>{t('customize.background')}</h3>
            <div class="swatch-grid" role="radiogroup" aria-label={t('customize.background')}>
                <Tile source={{ kind: 'theme' }} name={t('background.theme')} current={current} onChoose={pick()}>
                    <span class="swatch-fill is-theme" style={themeById(draft.themeId).tokens} />
                    <span class="swatch-caption">{t('background.theme')}</span>
                </Tile>
                {WALLPAPER_PRESETS.map(preset => (
                    <Tile key={preset.id} source={{ kind: 'preset', id: preset.id }} name={preset.name} current={current} onChoose={pick(preset.luminance, true)}
                        style={{ backgroundColor: preset.color, backgroundImage: preset.css }} />
                ))}
                <Tile source={background.source.kind === 'solid' ? background.source : { kind: 'solid', color: SOLID_DEFAULT }} name={t('background.solid')} current={current} onChoose={pick()}>
                    <span class="swatch-fill" style={{ background: background.source.kind === 'solid' ? background.source.color : SOLID_DEFAULT }} />
                    <span class="swatch-caption">{t('background.solid')}</span>
                </Tile>
                <Tile source={background.source.kind === 'gradient' ? background.source : { kind: 'gradient', ...GRADIENT_DEFAULT }} name={t('background.gradient')} current={current} onChoose={pick()}>
                    <span class="swatch-fill" style={{ background: `linear-gradient(${GRADIENT_DEFAULT.angle}deg, ${GRADIENT_DEFAULT.from}, ${GRADIENT_DEFAULT.to})` }} />
                    <span class="swatch-caption">{t('background.gradient')}</span>
                </Tile>
            </div>

            <h4>{t('background.photos')}</h4>
            <div class="swatch-grid" role="radiogroup" aria-label={t('background.photos')}>
                {WALLPAPER_PHOTOS.map(photo => (
                    <Tile key={photo.id} source={{ kind: 'preset', id: photo.id }} name={photo.name} current={current} onChoose={pick(photo.luminance)}
                        style={{ backgroundColor: photo.color, backgroundImage: `url("${photoUrl(photo.file!, 'thumb')}")` }} />
                ))}
            </div>

            <h4>{t('background.mine')}</h4>
            <div class="swatch-grid">
                {assets.map(asset => (
                    <div class="swatch-wrap" key={asset.id}>
                        <Tile source={{ kind: 'upload', assetId: asset.id }} name={asset.name} current={current} onChoose={pick(asset.luminance)}>
                            <UploadThumb asset={asset} />
                        </Tile>
                        {confirming === asset.id ? (
                            <button type="button" class="swatch-remove is-confirm" onClick={() => remove(asset.id)} onBlur={() => setConfirming(null)}>{t('remove')}</button>
                        ) : (
                            <button type="button" class="swatch-remove" aria-label={t('background.removeImage', { name: asset.name })} title={t('background.removeImage', { name: asset.name })}
                                onClick={() => setConfirming(asset.id)}>
                                <Icon name="x" size={12} />
                            </button>
                        )}
                    </div>
                ))}
                {!full && (
                    <button type="button" class="swatch-tile swatch-add" disabled={busy} onClick={() => fileRef.current?.click()}>
                        <Icon name={busy ? 'clock' : 'plus'} size={18} />
                        <span class="swatch-caption">{busy ? t('background.adding') : t('background.add')}</span>
                    </button>
                )}
            </div>
            <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} hidden
                onChange={event => {
                    void add(event.currentTarget.files?.[0]);
                    event.currentTarget.value = '';
                }} />
            <p class="customize-note">{full ? t('background.full', { n: MAX_WALLPAPERS }) : t('background.local')}</p>

            {background.source.kind === 'solid' && (
                <label class="color-row">
                    <span>{t('field.color')}</span>
                    <input type="color" value={background.source.color} onInput={event => onChange({ ...background, source: { kind: 'solid', color: event.currentTarget.value } })} />
                </label>
            )}
            {background.source.kind === 'gradient' && (
                <div class="color-row">
                    <span>{t('background.gradient')}</span>
                    <input type="color" aria-label={t('background.from')} value={background.source.from}
                        onInput={event => background.source.kind === 'gradient' && onChange({ ...background, source: { ...background.source, from: event.currentTarget.value } })} />
                    <input type="color" aria-label={t('background.to')} value={background.source.to}
                        onInput={event => background.source.kind === 'gradient' && onChange({ ...background, source: { ...background.source, to: event.currentTarget.value } })} />
                </div>
            )}

            {better.length > 0 && luminance !== undefined && (
                <div class="mood-hint" role="status" ref={hint => hint?.scrollIntoView({ block: 'nearest' })}>
                    <p>{t(`background.mood.${pictureMood(luminance)}` as MessageKey)}</p>
                    <div class="mood-actions">
                        {better.map(id => (
                            <button type="button" class="quiet-button" key={id} onClick={() => onTheme(id, { ...background, dim: suggestedDim(luminance, themeById(id).scheme, !!chosenPreset && !chosenPreset.file) })}>{t('background.mood.use', { name: themeById(id).name })}</button>
                        ))}
                    </div>
                </div>
            )}

            {isPicture && (
                <div class="tune">
                    {placeable && (
                        <div class="tune-row">
                            <Segmented label={t('background.fit')} value={background.fit} options={['cover', 'contain'] as const}
                                labelFor={option => t(`background.fit.${option}` as MessageKey)} onChange={fit => onChange({ ...background, fit })} />
                            <div class="position-grid" role="radiogroup" aria-label={t('background.position')}>
                                {POSITIONS.flatMap(y => POSITIONS.map(x => (
                                    <button type="button" key={`${x}-${y}`} role="radio" aria-checked={background.x === x && background.y === y}
                                        aria-label={`${t('background.position')} ${x}% ${y}%`} onClick={() => onChange({ ...background, x, y })} />
                                )))}
                            </div>
                        </div>
                    )}
                    <Slider label={t('background.dim')} value={background.dim} max={BACKGROUND_LIMITS.dim} step={0.02} onChange={dim => onChange({ ...background, dim })} />
                    <Slider label={t('background.blur')} value={background.blur} max={BACKGROUND_LIMITS.blur} step={1} onChange={blur => onChange({ ...background, blur })} />
                    {advanced
                        ? <Slider label={t('background.saturation')} value={background.saturation} max={BACKGROUND_LIMITS.saturation} step={0.05} onChange={saturation => onChange({ ...background, saturation })} />
                        : <button type="button" class="quiet-button" onClick={() => setAdvanced(true)}>{t('customize.more')}</button>}
                </div>
            )}
        </section>
    );
}

/**
 * Quick customize: theme, background, atmosphere and motion in one place, tried live on the
 * page behind and saved only on Apply. Escape, Cancel or closing puts everything back.
 */
export function Customize({ state }: { state: AppState }) {
    const view = useStore(ui);
    const mode = activeMode(state);
    const modeHasOwnLook = !!mode && (!!mode.themeId || !!mode.background);
    const [forMode, setForMode] = useState(modeHasOwnLook);
    /** The saved look that the chosen scope owns: the Mode's (as shown now) or the defaults. */
    const baseFor = (scopeIsMode: boolean): Appearance =>
        scopeIsMode ? savedAppearance(state) : { ...savedAppearance(state), themeId: state.prefs.themeId, background: state.prefs.background };
    const base = baseFor(forMode);
    const draft = view.preview ?? base;
    const change = (patch: Partial<Appearance>) => setUi({ preview: { ...draft, ...patch } });
    const close = () => setUi({ customize: false, preview: null });
    const changeScope = (scopeIsMode: boolean) => {
        setForMode(scopeIsMode);
        // Show what is being edited: the page follows the scope, not only the panel.
        setUi({ preview: baseFor(scopeIsMode) });
    };

    // Forget images whose file is gone (cleared site data, a restore from another profile).
    useEffect(() => {
        void listWallpaperIds().then(result => {
            if (!result.ok) return;
            const present = new Set(result.value);
            for (const id of Object.keys(app.get().wallpapers)) if (!present.has(id)) update(s => removeWallpaper(s, id));
            // And the reverse: files nothing refers to any more (a reset, an import that
            // replaced the setup). A restore point still counts as a reference.
            void ensureSnapshots().then(points => {
                const referenced = new Set([app.get(), ...points.map(point => point.state)].flatMap(s => Object.keys(s.wallpapers ?? {})));
                for (const id of present) if (!referenced.has(id)) void deleteWallpaper(id);
            });
        });
    }, []);

    const dirty = JSON.stringify(draft) !== JSON.stringify(base);

    return (
        <Overlay label={t('customize.title')} class="overlay-customize" onClose={close}>
            <header class="customize-head">
                <h2>{t('customize.title')}</h2>
                <button type="button" class="icon-button" title={t('close')} aria-label={t('close')} onClick={close}><Icon name="x" /></button>
            </header>
            <div class="customize-body">
                {mode && (
                    <Segmented label={t('customize.scope')} value={forMode ? 'mode' : 'all'} options={['all', 'mode'] as const}
                        labelFor={option => (option === 'all' ? t('customize.scope.all') : t('customize.scope.mode', { name: mode.name }))}
                        onChange={option => changeScope(option === 'mode')} />
                )}
                <section class="customize-section">
                    <h3>{t('settings.theme')}</h3>
                    <ThemePicker themeId={draft.themeId} onPick={themeId => change({ themeId })} />
                </section>
                <BackgroundSection state={state} draft={draft} onChange={background => change({ background })} onTheme={(themeId, background) => change({ themeId, background })} />
                <section class="customize-section">
                    <h3>{t('customize.atmosphere')}</h3>
                    <Segmented label={t('customize.atmosphere')} value={draft.atmosphere} options={ATMOSPHERE_LEVELS}
                        labelFor={option => t(`atmosphere.${option}` as MessageKey)} onChange={atmosphere => change({ atmosphere })} />
                    <p class="customize-note">{t('customize.atmosphereHint')}</p>
                </section>
                <section class="customize-section">
                    <h3>{t('settings.motion')}</h3>
                    <Segmented label={t('settings.motion')} value={draft.motion} options={MOTION_LEVELS}
                        labelFor={option => t(`motion.${option}` as MessageKey)} onChange={motion => change({ motion })} />
                    <p class="customize-note">{t('settings.motionHint')}</p>
                </section>
            </div>
            <footer class="customize-foot">
                <button type="button" class="button" onClick={close}>{t('cancel')}</button>
                {forMode && mode && modeHasOwnLook && (
                    <button type="button" class="quiet-button"
                        onClick={() => {
                            update(s => updateMode(s, mode.id, { themeId: '', background: null }));
                            close();
                        }}>
                        {t('customize.useDefault')}
                    </button>
                )}
                <button type="button" class="button is-primary" disabled={!dirty && !(forMode && !modeHasOwnLook)}
                    onClick={() => {
                        update(s => commitAppearance(s, draft, forMode));
                        close();
                        toast(forMode && mode ? t('customize.appliedMode', { name: mode.name }) : t('customize.applied'));
                    }}>
                    {t('customize.apply')}
                </button>
            </footer>
        </Overlay>
    );
}
