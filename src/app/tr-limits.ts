/** Turkish words about the size limits: loaded with the Turkish language, by whoever needs them. */
import type { LimitsKey } from './limitsText';

export const tr: Record<LimitsKey, string> = {
    iconTooLarge: 'Bu resim simge için çok büyük; sitenin kendi simgesi kullanılıyor.',
    lede: 'Kayıtlı veriler artık boyut sınırları içinde tutuluyor.',
    where: 'Özgün metin Ayarlar → Veriler bölümünde.',
    linksSkipped: 'Adresi kullanılamadığı veya çok uzun olduğu için alınmayan bağlantı: {n}.',
    titlesReplaced: 'Çok uzun olduğu için sitenin adıyla değiştirilen başlık: {n}.',
    namesReplaced: 'Çok uzun olduğu için varsayılanla değiştirilen ad: {n}.',
    iconsReencoded: 'Küçültülen büyük simge: {n}.',
    iconsDropped: 'Sitenin kendi simgesiyle değiştirilen simge: {n}.',
    kept: 'Özgün değerler saklandı',
    keptHint: 'Olduğu gibi saklanıyor: {titles} başlık, {names} ad, alınmayan {links} bağlantı. Geri almak için indir.',
    download: 'İndir',
    remove: 'Kaldır',
};
