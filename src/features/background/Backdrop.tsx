import { useEffect, useState } from 'preact/hooks';
import { presetById, sourceKey, type Background, type BackgroundSource, type WallpaperAsset } from '../../core/background';
import type { ID } from '../../core/types';
import { t } from '../../i18n';
import { toast } from '../../storage/store';
import { photoUrl } from './photos';

/** Images that failed this session, so the user is told once, not on every render. */
const reported = new Set<ID>();

/**
 * Resolves an uploaded image to a URL after first paint. The store module is loaded only
 * when an upload is actually in use, so it costs nothing at startup otherwise.
 */
function useUploadUrl(assetId: ID | undefined): string | null | undefined {
    const [url, setUrl] = useState<string | null | undefined>(undefined);
    useEffect(() => {
        setUrl(undefined);
        if (!assetId) return;
        let live = true;
        void import('../../browser/assets')
            .then(assets => assets.wallpaperUrl(assetId, 'full'))
            .catch(() => null)
            .then(result => {
                if (!live) return;
                setUrl(result);
                if (result === null && !reported.has(assetId)) {
                    reported.add(assetId);
                    toast(t('background.missing'));
                }
            });
        return () => {
            live = false;
        };
    }, [assetId]);
    return url;
}

/** The full picture. Fades in once decoded; reports itself if it turns out to be unreadable. */
function Photo({ url, placement, onBroken }: { url: string; placement: Record<string, string>; onBroken: () => void }) {
    const [ready, setReady] = useState(false);
    return (
        <img class={`backdrop-picture backdrop-photo ${ready ? 'is-ready' : ''}`} src={url} alt="" decoding="async" draggable={false} style={placement}
            onLoad={() => setReady(true)} onError={onBroken} />
    );
}

function Upload({ asset, background }: { asset: WallpaperAsset; background: Background }) {
    const url = useUploadUrl(asset.id);
    const [brokenUrl, setBrokenUrl] = useState<string | null>(null);

    // Missing, deleted or undecodable: show nothing here and let the theme backdrop beneath stand.
    if (url === null || (url && url === brokenUrl)) return null;

    const placement = { objectFit: background.fit, objectPosition: `${background.x}% ${background.y}%` };
    return (
        <>
            {/* Painted at once from a few hundred bytes kept with the settings: no flash, no shift. */}
            <div class="backdrop-picture backdrop-lqip" style={{ backgroundColor: asset.color, backgroundImage: asset.lqip ? `url(${asset.lqip})` : undefined, backgroundPosition: placement.objectPosition, backgroundSize: background.fit }} />
            {url && (
                <Photo key={url} url={url} placement={placement}
                    onBroken={() => {
                        setBrokenUrl(url);
                        if (!reported.has(asset.id)) {
                            reported.add(asset.id);
                            toast(t('background.missing'));
                        }
                    }} />
            )}
        </>
    );
}

/** One renderer per source kind. A new kind (video, cinemagraph) is one more entry here. */
function Picture({ source, background, assets }: { source: BackgroundSource; background: Background; assets: Record<ID, WallpaperAsset> }) {
    switch (source.kind) {
        case 'theme':
            return null;
        case 'solid':
            return <div class="backdrop-picture" style={{ background: source.color }} />;
        case 'gradient':
            return <div class="backdrop-picture" style={{ background: `linear-gradient(${source.angle}deg, ${source.from}, ${source.to})` }} />;
        case 'preset': {
            const preset = presetById(source.id);
            if (!preset) return null;
            if (!preset.file) return <div class="backdrop-picture" style={{ backgroundColor: preset.color, backgroundImage: preset.css }} />;
            const url = photoUrl(preset.file, 'full');
            return (
                <>
                    {/* The picture's own average colour holds the page until the photograph has decoded. */}
                    <div class="backdrop-picture" style={{ backgroundColor: preset.color }} />
                    <Photo key={url} url={url} placement={{ objectFit: background.fit, objectPosition: `${background.x}% ${background.y}%` }} onBroken={() => undefined} />
                </>
            );
        }
        case 'upload': {
            const asset = assets[source.assetId];
            return asset ? <Upload asset={asset} background={background} /> : null;
        }
    }
}

/**
 * The page backdrop: the theme's own background, an optional picture over it, the theme's
 * wash to pull the picture into the theme's mood, then atmosphere. The theme layer is always
 * present underneath, so a picture that fails or is still decoding never leaves a blank page.
 */
export function Backdrop({ themeId, background, assets }: { themeId: string; background: Background; assets: Record<ID, WallpaperAsset> }) {
    const picture = background.source.kind !== 'theme';
    // Blur softens edges into transparency; a slight overscale hides that.
    const tune = picture
        ? { filter: `blur(${background.blur}px) saturate(${background.saturation})`, transform: background.blur ? `scale(${1 + background.blur / 300})` : undefined }
        : undefined;
    return (
        // Keyed by theme and picture: a change cross-fades in as one scene instead of snapping.
        <div class="backdrop" key={`${themeId}|${sourceKey(background.source)}`} data-picture={picture ? '' : undefined} aria-hidden="true">
            {picture && (
                <>
                    <div class="backdrop-stage" style={tune}>
                        <Picture source={background.source} background={background} assets={assets} />
                    </div>
                    <i class="backdrop-wash" style={{ opacity: background.dim }} />
                </>
            )}
            <i class="backdrop-fog" />
            <i class="backdrop-glow" />
            <i class="backdrop-bloom" />
        </div>
    );
}
