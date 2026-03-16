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
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).put(blob, this.key(videoId, idx));
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async get(videoId, idx) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(this.key(videoId, idx));
            req.onsuccess = (e) => resolve(e.target.result || null);
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
