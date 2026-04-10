const DB_NAME = 'biubiu-recordings';
const STORE_NAME = 'recordings';

class RecordingStorage {
    constructor() {
        this.db = null;
    }

    async open() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
                    e.target.result.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    key(videoId, idx) {
        return `video_${videoId}_subtitle_${idx}`;
    }

    async save(videoId, idx, blob) {
        // 把 Blob 转成 ArrayBuffer 再存，兼容 iOS Safari 等不支持直接存 Blob 的浏览器
        let arrayBuffer;
        if (blob.arrayBuffer) {
            arrayBuffer = await blob.arrayBuffer();
        } else {
            arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsArrayBuffer(blob);
            });
        }
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).put(
                { data: arrayBuffer, type: blob.type },
                this.key(videoId, idx)
            );
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async get(videoId, idx) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(this.key(videoId, idx));
            req.onsuccess = (e) => {
                const result = e.target.result;
                if (!result) { resolve(null); return; }
                // 新格式：{ data: ArrayBuffer, type }
                if (result.data instanceof ArrayBuffer) {
                    resolve(new Blob([result.data], { type: result.type || 'audio/webm' }));
                    return;
                }
                // 旧格式：直接存的 Blob（兼容已有录音数据）
                if (result instanceof Blob) {
                    resolve(result);
                    return;
                }
                resolve(null);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async delete(videoId, idx) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).delete(this.key(videoId, idx));
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async getIndicesForVideo(videoId) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAllKeys();
            req.onsuccess = (e) => {
                const prefix = `video_${videoId}_subtitle_`;
                resolve(
                    e.target.result
                        .filter(k => k.startsWith(prefix))
                        .map(k => parseInt(k.slice(prefix.length), 10))
                );
            };
            req.onerror = (e) => reject(e.target.error);
        });
    }
}

export const recordingStorage = new RecordingStorage();
