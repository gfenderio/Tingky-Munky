import * as fs from 'fs';
import * as path from 'path';

/**
 * Cari root aplikasi (folder yang punya package.json), naik maksimal 5 tingkat
 * dari lokasi file yang sedang jalan.
 *
 * Ini penting karena entry point-nya berpindah-pindah:
 *   - dev/tsc  -> dist/index.js  (root = ../)
 *   - Discloud -> index.js       (root = ./)
 * Pakai path.join(__dirname, '..') secara langsung bikin data nyasar ke /home
 * waktu bundle-nya ditaruh di root container.
 */
function findAppRoot(): string {
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return process.cwd();
}

export const APP_ROOT = findAppRoot();

/** Berkas di dalam ./data — foldernya dibuat kalau belum ada. */
export function dataFile(name: string): string {
    const dir = path.join(APP_ROOT, 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, name);
}

/** Berkas di dalam ./assets, absolut supaya tidak tergantung working directory. */
export function assetFile(name: string): string {
    return path.join(APP_ROOT, 'assets', name);
}

/**
 * Nilai dari .env bisa berupa './assets/foo.png' (relatif) atau URL.
 * Yang relatif dijadikan absolut terhadap root aplikasi.
 */
export function resolveAssetPath(value: string): string {
    if (/^https?:\/\//i.test(value)) return value;
    if (path.isAbsolute(value)) return value;
    return path.resolve(APP_ROOT, value);
}
