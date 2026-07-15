const defaultMyAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%232c3e50"/><circle cx="50" cy="40" r="16" fill="%23fce2c4"/><path d="M 25 100 L 35 65 Q 50 55 65 65 L 75 100" fill="%23fce2c4"/></svg>';
const defaultOtherAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23c0392b"/><circle cx="50" cy="50" r="30" fill="%23f1c40f"/><path d="M 35 35 L 45 45 L 35 55 M 65 35 L 55 45 L 65 55" stroke="%23c0392b" stroke-width="4" fill="none"/></svg>';
const defaultOtherAvatar2 = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%233b82f6"/><circle cx="50" cy="39" r="18" fill="%23fde6d2"/><path d="M20 100c4-25 16-39 30-39s26 14 30 39" fill="%23f5f7fb"/></svg>';
const defaultOtherAvatar3 = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%237c3aed"/><circle cx="50" cy="39" r="18" fill="%23f7d7c4"/><path d="M20 100c4-25 16-39 30-39s26 14 30 39" fill="%23facc15"/></svg>';
const defaultImage = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%23d8e7d2"/><stop offset="1" stop-color="%23f4d2c2"/></linearGradient></defs><rect width="200" height="250" fill="url(%23g)"/><circle cx="100" cy="88" r="34" fill="%23ffffff" opacity=".72"/><path d="M40 214c9-43 31-67 60-67s51 24 60 67" fill="%23ffffff" opacity=".72"/></svg>';
const exportTransparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const STATE_STORAGE_KEY = 'wechat_editor_state_v19';
const LEGACY_STATE_STORAGE_KEY = 'wechat_editor_state_v18';
const CURRENT_STATE_SCHEMA = 3;
const OPPONENT_IDS = ['other1', 'other2', 'other3'];
const BACKUP_FORMAT = 'wechat-screenshot-pwa-backup';
const ASSET_DATABASE_NAME = 'wechat_screenshot_pwa';
const ASSET_DATABASE_VERSION = 1;
const ASSET_STORE_NAME = 'assets';
const MAX_STORED_IMAGE_BYTES = 1_500_000;
let assetDatabasePromise = null;

function createAssetId(prefix = 'asset') {
    const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return `${prefix}_${randomPart}`;
}

function openAssetDatabase() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB is unavailable'));
    if (assetDatabasePromise) return assetDatabasePromise;

    assetDatabasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(ASSET_DATABASE_NAME, ASSET_DATABASE_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(ASSET_STORE_NAME)) {
                database.createObjectStore(ASSET_STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB'));
    });

    return assetDatabasePromise;
}

async function putAssetBlob(blob, preferredId = createAssetId()) {
    const database = await openAssetDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(ASSET_STORE_NAME, 'readwrite');
        transaction.objectStore(ASSET_STORE_NAME).put({
            id: preferredId,
            blob,
            type: blob.type,
            size: blob.size,
            updatedAt: new Date().toISOString()
        });
        transaction.oncomplete = () => resolve(preferredId);
        transaction.onerror = () => reject(transaction.error || new Error('Unable to store image asset'));
        transaction.onabort = () => reject(transaction.error || new Error('Image asset transaction aborted'));
    });
}

async function getAssetBlob(assetId) {
    if (!assetId) return null;
    const database = await openAssetDatabase();
    return new Promise((resolve, reject) => {
        const request = database.transaction(ASSET_STORE_NAME, 'readonly').objectStore(ASSET_STORE_NAME).get(assetId);
        request.onsuccess = () => resolve(request.result?.blob || null);
        request.onerror = () => reject(request.error || new Error('Unable to read image asset'));
    });
}

async function deleteAssetBlob(assetId) {
    if (!assetId) return;
    const database = await openAssetDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(ASSET_STORE_NAME, 'readwrite');
        transaction.objectStore(ASSET_STORE_NAME).delete(assetId);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('Unable to delete image asset'));
    });
}

async function clearAssetBlobs() {
    const database = await openAssetDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(ASSET_STORE_NAME, 'readwrite');
        transaction.objectStore(ASSET_STORE_NAME).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('Unable to clear image assets'));
    });
}

async function listAssetIds() {
    const database = await openAssetDatabase();
    return new Promise((resolve, reject) => {
        const request = database.transaction(ASSET_STORE_NAME, 'readonly').objectStore(ASSET_STORE_NAME).getAllKeys();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error('Unable to list image assets'));
    });
}

async function removeUnusedAssetBlobs(referencedIds) {
    const keep = new Set(referencedIds.filter(Boolean));
    const storedIds = await listAssetIds();
    await Promise.all(storedIds.filter(assetId => !keep.has(assetId)).map(assetId => deleteAssetBlob(assetId)));
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Unable to read image data'));
        reader.readAsDataURL(blob);
    });
}

async function dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error('Unable to decode stored image data');
    return response.blob();
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(`Unable to encode ${type}`)), type, quality);
    });
}

function loadImageSource(file) {
    if ('createImageBitmap' in window) {
        return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadImageElement(file));
    }
    return loadImageElement(file);
}

function loadImageElement(file) {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('无法读取所选图片'));
        };
        image.src = objectUrl;
    });
}

async function compressImageFile(file, { maxDimension = 1600 } = {}) {
    if (!file?.type?.startsWith('image/')) throw new Error('请选择有效的图片文件');

    const source = await loadImageSource(file);
    const sourceWidth = source.naturalWidth || source.width;
    const sourceHeight = source.naturalHeight || source.height;
    if (!sourceWidth || !sourceHeight) throw new Error('无法读取图片尺寸');

    const initialScale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    let canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * initialScale));
    canvas.height = Math.max(1, Math.round(sourceHeight * initialScale));
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    source.close?.();

    let outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    let outputBlob = await canvasToBlob(canvas, outputType, 0.86);

    if (outputBlob.size > MAX_STORED_IMAGE_BYTES && outputType === 'image/png') {
        try {
            outputBlob = await canvasToBlob(canvas, 'image/webp', 0.82);
            outputType = 'image/webp';
        } catch (error) {
            console.warn('WebP compression is unavailable; keeping PNG.', error);
        }
    }

    while (outputBlob.size > MAX_STORED_IMAGE_BYTES && Math.max(canvas.width, canvas.height) > 720) {
        const smallerCanvas = document.createElement('canvas');
        smallerCanvas.width = Math.max(1, Math.round(canvas.width * 0.8));
        smallerCanvas.height = Math.max(1, Math.round(canvas.height * 0.8));
        smallerCanvas.getContext('2d').drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
        canvas = smallerCanvas;
        outputBlob = await canvasToBlob(canvas, outputType, 0.76);
    }

    return {
        blob: outputBlob,
        dataUrl: await blobToDataUrl(outputBlob),
        width: canvas.width,
        height: canvas.height
    };
}

// 定义一套初始默认数据，方便重置和初始化
const defaultState = {
    schemaVersion: CURRENT_STATE_SCHEMA,
    isDarkMode: false, 
    statusBarTime: '18:43', 
    returnAppText: '', 
    chatName: '塔西', 
    unreadCount: '92', 
    batteryLevel: 65,
    networkType: '5G',
    showOtherName: false, 
    myAvatar: defaultMyAvatar,
    myAvatarAssetId: null,
    opponents: [
        { id: 'other1', name: '塔西', avatar: defaultOtherAvatar, avatarAssetId: null },
        { id: 'other2', name: '', avatar: defaultOtherAvatar2, avatarAssetId: null },
        { id: 'other3', name: '', avatar: defaultOtherAvatar3, avatarAssetId: null }
    ],
    messages: [
        { id: 1, type: 'text', senderId: 'other1', isMe: false, content: '欢迎使用' }
    ]
};

const { createApp } = Vue;

createApp({
    data() {
        return {
            // 深拷贝一份默认数据作为初始状态
            ...JSON.parse(JSON.stringify(defaultState)),
            activePage: 'home',
            toolsExpanded: false,
            generatedImageUrl: '',
            generatedImageDirty: false,
            generatedImageStatus: '',
            generatedImagePanelVisible: false,
            chatTitleScale: 1,
            dragIndex: null,
            dragOverIndex: null,
            pointerSortPointerId: null,
            isHydrating: true,
            supportsFileShare: false,
            storageStatus: '正在初始化本地存储…',
            storageStatusType: 'normal'
        }
    },
    async mounted() {
        // 页面加载时读取本地存储
        await this.loadState();
        this.updateChatTitleScale();
        document.fonts?.ready?.then(() => this.updateChatTitleScale()).catch(() => {});
        try {
            const probeFile = new File([new Blob(['share-probe'], { type: 'image/png' })], 'share-probe.png', { type: 'image/png' });
            this.supportsFileShare = Boolean(navigator.share && navigator.canShare?.({ files: [probeFile] }));
        } catch (error) {
            this.supportsFileShare = false;
        }
    },
    watch: {
        // 监听数据变化，实现自动保存功能
        isDarkMode: 'saveState',
        statusBarTime: 'saveState',
        returnAppText: 'saveState',
        chatName: {
            handler() {
                this.saveState();
                this.updateChatTitleScale();
            }
        },
        unreadCount: 'saveState',
        batteryLevel: 'saveState',
        networkType: 'saveState',
        showOtherName: 'saveState',
        myAvatar: 'saveState',
        myAvatarAssetId: 'saveState',
        opponents: {
            handler: 'saveState',
            deep: true
        },
        messages: {
            handler: 'saveState',
            deep: true
        }
    },
    methods: {
        updateChatTitleScale() {
            this.$nextTick(() => {
                const frame = this.$refs.chatTitleFrame;
                const title = this.$refs.chatTitle;
                if (!frame || !title) return;
                const availableWidth = Math.max(1, frame.clientWidth - 4);
                const naturalWidth = Math.max(1, title.scrollWidth);
                this.chatTitleScale = Math.min(1, availableWidth / naturalWidth);
            });
        },
        markGeneratedImageDirty() {
            if (!this.generatedImageUrl) return;
            this.generatedImageDirty = true;
            this.generatedImagePanelVisible = true;
            this.generatedImageStatus = '内容已变化，请重新生成图片';
        },
        normalizeState(rawState) {
            const source = rawState && typeof rawState === 'object' ? rawState : {};
            const normalized = JSON.parse(JSON.stringify(defaultState));
            const scalarFields = [
                'isDarkMode', 'statusBarTime', 'returnAppText', 'chatName', 'unreadCount',
                'batteryLevel', 'networkType', 'showOtherName'
            ];

            scalarFields.forEach(field => {
                if (Object.prototype.hasOwnProperty.call(source, field)) normalized[field] = source[field];
            });

            normalized.myAvatar = typeof source.myAvatar === 'string' ? source.myAvatar : defaultMyAvatar;
            normalized.myAvatarAssetId = typeof source.myAvatarAssetId === 'string' ? source.myAvatarAssetId : null;
            const sourceOpponents = Array.isArray(source.opponents) ? source.opponents : [];
            normalized.opponents = defaultState.opponents.map((fallback, index) => {
                const candidate = sourceOpponents.find(opponent => opponent?.id === fallback.id) || sourceOpponents[index] || {};
                const legacyCandidate = index === 0 ? {
                    name: source.otherName,
                    avatar: source.otherAvatar,
                    avatarAssetId: source.otherAvatarAssetId
                } : {};
                const participant = sourceOpponents.length ? candidate : legacyCandidate;
                return {
                    id: fallback.id,
                    name: typeof participant.name === 'string' ? participant.name : fallback.name,
                    avatar: typeof participant.avatar === 'string' ? participant.avatar : fallback.avatar,
                    avatarAssetId: typeof participant.avatarAssetId === 'string' ? participant.avatarAssetId : null
                };
            });
            normalized.messages = Array.isArray(source.messages)
                ? source.messages.filter(message => message && typeof message === 'object').map(message => {
                    const senderId = message.senderId === 'me' || OPPONENT_IDS.includes(message.senderId)
                        ? message.senderId
                        : (message.isMe ? 'me' : 'other1');
                    return { ...message, senderId, isMe: senderId === 'me' };
                })
                : JSON.parse(JSON.stringify(defaultState.messages));
            normalized.schemaVersion = CURRENT_STATE_SCHEMA;
            return normalized;
        },
        createStateSnapshot({ portable = false } = {}) {
            return {
                schemaVersion: CURRENT_STATE_SCHEMA,
                isDarkMode: this.isDarkMode,
                statusBarTime: this.statusBarTime,
                returnAppText: this.returnAppText,
                chatName: this.chatName,
                unreadCount: this.unreadCount,
                batteryLevel: this.batteryLevel,
                networkType: this.networkType,
                showOtherName: this.showOtherName,
                myAvatar: portable || !this.myAvatarAssetId ? this.myAvatar : '',
                myAvatarAssetId: portable ? null : this.myAvatarAssetId,
                opponents: this.opponents.map(opponent => ({
                    id: opponent.id,
                    name: opponent.name,
                    avatar: portable || !opponent.avatarAssetId ? opponent.avatar : '',
                    avatarAssetId: portable ? null : opponent.avatarAssetId
                })),
                messages: this.messages.map(message => ({
                    ...message,
                    imageUrl: message.type === 'image' && !portable && message.imageAssetId ? '' : message.imageUrl,
                    imageAssetId: portable ? null : (message.imageAssetId || null)
                }))
            };
        },
        async persistInlineImage(dataUrl, prefix) {
            if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
            const blob = await dataUrlToBlob(dataUrl);
            return putAssetBlob(blob, createAssetId(prefix));
        },
        async migrateInlineImagesToAssets(rawState) {
            const state = this.normalizeState(rawState);
            try {
                if (!state.myAvatarAssetId) {
                    state.myAvatarAssetId = await this.persistInlineImage(state.myAvatar, 'avatar_me');
                }
                for (const opponent of state.opponents) {
                    if (!opponent.avatarAssetId) {
                        opponent.avatarAssetId = await this.persistInlineImage(opponent.avatar, `avatar_${opponent.id}`);
                    }
                }
                for (const message of state.messages) {
                    if (message.type === 'image' && !message.imageAssetId) {
                        message.imageAssetId = await this.persistInlineImage(message.imageUrl, 'message');
                    }
                }
                this.storageStatus = '已启用图片压缩和 IndexedDB 存储';
                this.storageStatusType = 'normal';
            } catch (error) {
                console.warn('IndexedDB 图片迁移失败，将保留内联图片。', error);
                this.storageStatus = 'IndexedDB 不可用，图片将暂存于 localStorage';
                this.storageStatusType = 'error';
            }
            return state;
        },
        async hydrateStateAssets(rawState) {
            const state = this.normalizeState(rawState);
            const hydrate = async (assetId, fallback) => {
                if (!assetId) return fallback;
                try {
                    const blob = await getAssetBlob(assetId);
                    return blob ? await blobToDataUrl(blob) : fallback;
                } catch (error) {
                    console.warn(`无法读取图片资源 ${assetId}`, error);
                    this.storageStatus = '部分 IndexedDB 图片无法读取，请尽快导出备份';
                    this.storageStatusType = 'error';
                    return fallback;
                }
            };

            state.myAvatar = await hydrate(state.myAvatarAssetId, state.myAvatar || defaultMyAvatar);
            for (const [index, opponent] of state.opponents.entries()) {
                const fallbackAvatar = defaultState.opponents[index]?.avatar || defaultOtherAvatar;
                opponent.avatar = await hydrate(opponent.avatarAssetId, opponent.avatar || fallbackAvatar);
            }
            for (const message of state.messages) {
                if (message.type === 'image') {
                    message.imageUrl = await hydrate(message.imageAssetId, message.imageUrl || defaultImage);
                }
            }
            return state;
        },
        resetGeneratedImageState() {
            this.generatedImageUrl = '';
            this.generatedImageDirty = false;
            this.generatedImageStatus = '';
            this.generatedImagePanelVisible = false;
        },
        // 保存轻量状态到 localStorage；图片二进制保存在 IndexedDB
        saveState() {
            if (this.isHydrating) return false;
            try {
                this.markGeneratedImageDirty();
                localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(this.createStateSnapshot()));
                return true;
            } catch (e) {
                console.error('保存状态失败。', e);
                if (e.name === 'QuotaExceededError') {
                    alert('本地存储空间不足。请先导出备份，删除部分图片后重试。');
                }
                return false;
            }
        },
        // 读取新版状态；首次运行时安全迁移 v18
        async loadState() {
            this.isHydrating = true;
            let sourceKey = null;
            let parsedState = null;

            try {
                const currentState = localStorage.getItem(STATE_STORAGE_KEY);
                const legacyState = localStorage.getItem(LEGACY_STATE_STORAGE_KEY);

                if (currentState) {
                    try {
                        parsedState = JSON.parse(currentState);
                        sourceKey = STATE_STORAGE_KEY;
                    } catch (error) {
                        console.error('新版状态损坏，尝试读取旧版备份。', error);
                    }
                }

                if (!parsedState && legacyState) {
                    parsedState = JSON.parse(legacyState);
                    sourceKey = LEGACY_STATE_STORAGE_KEY;
                }

                if (parsedState) {
                    const migratedState = await this.migrateInlineImagesToAssets(parsedState);
                    const hydratedState = await this.hydrateStateAssets(migratedState);
                    Object.assign(this, hydratedState);
                } else {
                    try {
                        await openAssetDatabase();
                        this.storageStatus = '已启用图片压缩和 IndexedDB 存储';
                        this.storageStatusType = 'normal';
                    } catch (error) {
                        this.storageStatus = 'IndexedDB 不可用，图片将暂存于 localStorage';
                        this.storageStatusType = 'error';
                    }
                }

                await this.$nextTick();
                this.isHydrating = false;
                const saved = this.saveState();
                if (saved && sourceKey === LEGACY_STATE_STORAGE_KEY) {
                    localStorage.removeItem(LEGACY_STATE_STORAGE_KEY);
                }
            } catch (e) {
                console.error('加载历史数据失败', e);
                this.storageStatus = '历史数据加载失败，当前显示默认内容';
                this.storageStatusType = 'error';
            } finally {
                this.isHydrating = false;
            }
        },
        // 一键重置数据
        async resetState() {
            if (confirm('确定要清空所有自定义数据并恢复到默认状态吗？')) {
                this.isHydrating = true;
                const freshState = JSON.parse(JSON.stringify(defaultState));
                Object.assign(this, freshState);
                this.resetGeneratedImageState();
                localStorage.removeItem(STATE_STORAGE_KEY);
                localStorage.removeItem(LEGACY_STATE_STORAGE_KEY);
                try {
                    await clearAssetBlobs();
                    this.storageStatus = '已清空数据，IndexedDB 可用';
                    this.storageStatusType = 'normal';
                } catch (error) {
                    console.warn('清理 IndexedDB 失败。', error);
                    this.storageStatus = '编辑内容已重置，但图片存储清理失败';
                    this.storageStatusType = 'error';
                }
                await this.$nextTick();
                this.isHydrating = false;
                this.saveState();
            }
        },
        getReferencedAssetIds() {
            return [
                this.myAvatarAssetId,
                ...this.opponents.map(opponent => opponent.avatarAssetId),
                ...this.messages.map(message => message.imageAssetId)
            ].filter(Boolean);
        },
        async cleanupUnusedAssets() {
            try {
                await removeUnusedAssetBlobs(this.getReferencedAssetIds());
            } catch (error) {
                console.warn('清理未使用图片失败。', error);
            }
        },
        downloadBlob(blob, fileName) {
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = fileName;
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        },
        createBackupPayload() {
            return {
                format: BACKUP_FORMAT,
                version: 1,
                exportedAt: new Date().toISOString(),
                state: this.createStateSnapshot({ portable: true })
            };
        },
        exportBackup() {
            try {
                const backup = this.createBackupPayload();
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
                this.downloadBlob(blob, `微信截图备份_${new Date().toISOString().slice(0, 10)}.json`);
            } catch (error) {
                console.error('导出备份失败。', error);
                alert('导出备份失败，请重试。');
            }
        },
        async applyImportedState(importedState) {
            this.isHydrating = true;
            const migratedState = await this.migrateInlineImagesToAssets(importedState);
            const hydratedState = await this.hydrateStateAssets(migratedState);
            Object.assign(this, hydratedState);
            this.resetGeneratedImageState();
            await this.$nextTick();
            this.isHydrating = false;
            if (!this.saveState()) throw new Error('无法保存导入的数据');
            localStorage.removeItem(LEGACY_STATE_STORAGE_KEY);
            await this.cleanupUnusedAssets();
        },
        async importBackup(event) {
            const input = event.target;
            const file = input.files?.[0];
            if (!file) return;

            try {
                if (file.size > 50 * 1024 * 1024) throw new Error('备份文件超过 50 MB');
                const backup = JSON.parse(await file.text());
                if (backup?.format !== BACKUP_FORMAT || backup?.version !== 1 || !backup?.state) {
                    throw new Error('不是受支持的项目备份文件');
                }
                if (!Array.isArray(backup.state.messages)) throw new Error('备份缺少消息列表');
                if (!confirm('导入备份会覆盖当前编辑内容，是否继续？')) return;

                await this.applyImportedState(backup.state);
                this.storageStatus = '备份导入成功，图片已保存到 IndexedDB';
                this.storageStatusType = 'normal';
                alert('备份导入成功。');
            } catch (error) {
                console.error('导入备份失败。', error);
                this.storageStatus = `备份导入失败：${error.message}`;
                this.storageStatusType = 'error';
                alert(`导入备份失败：${error.message}`);
            } finally {
                this.isHydrating = false;
                input.value = '';
            }
        },
        async processAndStoreImage(file, prefix, maxDimension) {
            const processed = await compressImageFile(file, { maxDimension });
            let assetId = null;
            try {
                assetId = await putAssetBlob(processed.blob, createAssetId(prefix));
                this.storageStatus = `图片已压缩至 ${processed.width} × ${processed.height}，并保存到 IndexedDB`;
                this.storageStatusType = 'normal';
            } catch (error) {
                console.warn('IndexedDB 写入失败，使用内联图片回退。', error);
                this.storageStatus = 'IndexedDB 写入失败，图片仅保存在当前浏览器状态中';
                this.storageStatusType = 'error';
            }
            return { ...processed, assetId };
        },
        getOpponentDisplayName(opponent, index = this.opponents.indexOf(opponent)) {
            const name = typeof opponent?.name === 'string' ? opponent.name.trim() : '';
            return name || `对方${Math.max(0, index) + 1}`;
        },
        getMessageOpponent(msg) {
            return this.opponents.find(opponent => opponent.id === msg.senderId) || this.opponents[0];
        },
        getMessageSenderName(msg) {
            const opponent = this.getMessageOpponent(msg);
            return this.getOpponentDisplayName(opponent);
        },
        getMessageAvatar(msg) {
            return this.isMessageFromMe(msg) ? this.myAvatar : this.getMessageOpponent(msg)?.avatar || defaultOtherAvatar;
        },
        isMessageFromMe(msg) {
            return msg?.senderId === 'me' || (!msg?.senderId && Boolean(msg?.isMe));
        },
        setMessageSender(msg, senderId) {
            const normalizedSenderId = senderId === 'me' || OPPONENT_IDS.includes(senderId) ? senderId : 'other1';
            msg.senderId = normalizedSenderId;
            msg.isMe = normalizedSenderId === 'me';
        },
        getTextClass(msg) {
            const theme = this.isDarkMode ? 'dark' : 'light';
            const side = this.isMessageFromMe(msg) ? 'right' : 'left';
            const shadow = (!this.isDarkMode) ? 'wechat-soft-shadow' : '';
            return `wechat-${theme}-${side} bubble-${side}-${theme} ${shadow}`;
        },
        getTransferClass(msg) {
            const theme = this.isDarkMode ? 'dark' : 'light';
            const side = this.isMessageFromMe(msg) ? 'right' : 'left';
            const state = msg.status === 'pending' ? 'pending' : 'accepted';
            const shadow = (!this.isDarkMode) ? 'wechat-soft-shadow' : '';
            return `transfer-${state}-${theme} bubble-${side}-orange-${state}-${theme} ${shadow}`;
        },
        getRedPacketClass(msg) {
            const theme = this.isDarkMode ? 'dark' : 'light';
            const side = this.isMessageFromMe(msg) ? 'right' : 'left';
            const state = msg.status === 'pending' ? 'pending' : 'accepted';
            const shadow = (!this.isDarkMode) ? 'wechat-soft-shadow' : '';
            return `redpacket-${state}-${theme} bubble-${side}-redpacket-${state}-${theme} ${shadow}`;
        },
        getVoiceWidth(sec) {
            if(!sec || sec < 1) sec = 1;
            return Math.min(70 + (sec * 4), 220) + 'px';
        },
        batteryFillWidth() {
            const level = Math.max(0, Math.min(100, Number(this.batteryLevel) || 0));
            return (20.2 * level / 100).toFixed(2);
        },
        getImageBubbleStyle(msg) {
            const naturalWidth = Number(msg.imageWidth);
            const naturalHeight = Number(msg.imageHeight);
            if (!naturalWidth || !naturalHeight) {
                return { width: '150px', height: '150px' };
            }

            const ratio = naturalWidth / naturalHeight;
            let width;
            let height;

            if (ratio < 0.75) {
                height = 188;
                width = Math.round(height * ratio);
                width = Math.max(84, Math.min(128, width));
            } else if (ratio > 1.25) {
                width = 160;
                height = Math.round(width / ratio);
                height = Math.max(92, Math.min(150, height));
            } else {
                width = 150;
                height = Math.round(width / ratio);
                height = Math.max(120, Math.min(170, height));
            }

            return {
                width: `${width}px`,
                height: `${height}px`
            };
        },
        onPreviewImageLoad(event, msg) {
            const img = event.target;
            if (!img?.naturalWidth || !img?.naturalHeight) return;
            if (msg.imageWidth === img.naturalWidth && msg.imageHeight === img.naturalHeight) return;
            msg.imageWidth = img.naturalWidth;
            msg.imageHeight = img.naturalHeight;
        },
        addMessage(type) {
            const baseMsg = { id: Date.now(), type: type, senderId: 'me', isMe: true };
            if (type === 'text') baseMsg.content = '输入内容...';
            else if (type === 'image') { baseMsg.imageUrl = defaultImage; baseMsg.imageAssetId = null; baseMsg.imageWidth = 200; baseMsg.imageHeight = 250; }
            else if (type === 'voice') { baseMsg.duration = 10; baseMsg.status = 'unread'; baseMsg.convertedText = '转换后的文字...'; }
            else if (type === 'transfer') { baseMsg.amount = '¥1.00'; baseMsg.title = '请收款'; baseMsg.bottomText = '转账'; baseMsg.status = 'pending'; }
            else if (type === 'redPacket') { baseMsg.title = '恭喜发财，大吉大利'; baseMsg.statusText = '已领取'; baseMsg.bottomText = '红包'; baseMsg.status = 'pending'; }
            else if (type === 'call') baseMsg.content = '通话时长 12:34';
            else if (type === 'time') {
                const now = new Date();
                baseMsg.content = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
            } else if (type === 'nudge') baseMsg.content = '我拍了拍 "对方"';

            this.messages.push(baseMsg);
            this.scrollToBottom();
        },
        removeMessage(index) {
            const [removedMessage] = this.messages.splice(index, 1);
            if (removedMessage?.imageAssetId) {
                deleteAssetBlob(removedMessage.imageAssetId).catch(error => console.warn('删除消息图片失败。', error));
            }
        },
        moveMessage(fromIndex, toIndex) {
            if (fromIndex === toIndex) return;
            if (fromIndex < 0 || fromIndex >= this.messages.length) return;
            if (toIndex < 0 || toIndex >= this.messages.length) return;
            const [message] = this.messages.splice(fromIndex, 1);
            this.messages.splice(toIndex, 0, message);
        },
        moveMessageByOffset(index, offset) {
            this.moveMessage(index, index + offset);
        },
        clearSortState() {
            this.dragIndex = null;
            this.dragOverIndex = null;
            this.pointerSortPointerId = null;
        },
        onDragStart(event, index) {
            this.dragIndex = index;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', index);
        },
        onDragEnter(index) { if(this.dragIndex !== index) this.dragOverIndex = index; },
        onDragOver(event, index) { event.preventDefault(); },
        onDragLeave(index) { if(this.dragOverIndex === index) this.dragOverIndex = null; },
        onDrop(event, index) {
            if (this.dragIndex !== null && this.dragIndex !== index) {
                this.moveMessage(this.dragIndex, index);
            }
            this.clearSortState();
        },
        onDragEnd() { this.clearSortState(); },
        onPointerSortStart(event, index) {
            if (event.pointerType === 'mouse') return;
            event.preventDefault();
            this.dragIndex = index;
            this.dragOverIndex = index;
            this.pointerSortPointerId = event.pointerId;
            event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        onPointerSortMove(event) {
            if (this.pointerSortPointerId !== event.pointerId || this.dragIndex === null) return;
            event.preventDefault();
            const card = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-message-id]');
            if (!card) return;
            const targetIndex = this.messages.findIndex(message => String(message.id) === card.dataset.messageId);
            if (targetIndex >= 0) this.dragOverIndex = targetIndex;
        },
        onPointerSortEnd(event) {
            if (this.pointerSortPointerId !== event.pointerId) return;
            event.preventDefault();
            const fromIndex = this.dragIndex;
            const toIndex = this.dragOverIndex;
            try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch (error) {}
            if (fromIndex !== null && toIndex !== null) this.moveMessage(fromIndex, toIndex);
            this.clearSortState();
        },
        onPointerSortCancel(event) {
            if (this.pointerSortPointerId !== event.pointerId) return;
            try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch (error) {}
            this.clearSortState();
        },
        async onAvatarChange(event, participantId) {
            const input = event.target;
            const file = input.files?.[0];
            if (!file) return;

            try {
                const opponent = this.opponents.find(item => item.id === participantId);
                if (participantId !== 'me' && !opponent) throw new Error('找不到对应的群聊成员');
                const processed = await this.processAndStoreImage(file, participantId === 'me' ? 'avatar_me' : `avatar_${participantId}`, 1024);
                const previousAssetId = participantId === 'me' ? this.myAvatarAssetId : opponent.avatarAssetId;
                if (participantId === 'me') {
                    this.myAvatar = processed.dataUrl;
                    this.myAvatarAssetId = processed.assetId;
                } else {
                    opponent.avatar = processed.dataUrl;
                    opponent.avatarAssetId = processed.assetId;
                }
                if (previousAssetId && previousAssetId !== processed.assetId) {
                    deleteAssetBlob(previousAssetId).catch(error => console.warn('删除旧头像失败。', error));
                }
            } catch (error) {
                console.error('头像处理失败。', error);
                alert(`头像处理失败：${error.message}`);
            } finally {
                input.value = '';
            }
        },
        async onMsgImageUpload(event, msg) {
            const input = event.target;
            const file = input.files?.[0];
            if (!file) return;

            try {
                const processed = await this.processAndStoreImage(file, 'message', 1600);
                const previousAssetId = msg.imageAssetId;
                msg.imageUrl = processed.dataUrl;
                msg.imageAssetId = processed.assetId;
                msg.imageWidth = processed.width;
                msg.imageHeight = processed.height;
                if (previousAssetId && previousAssetId !== processed.assetId) {
                    deleteAssetBlob(previousAssetId).catch(error => console.warn('删除旧消息图片失败。', error));
                }
            } catch (error) {
                console.error('消息图片处理失败。', error);
                alert(`图片处理失败：${error.message}`);
            } finally {
                input.value = '';
            }
        },
        scrollToBottom() {
            setTimeout(() => {
                const preview = document.querySelector('#wechat-preview > div:nth-child(3)');
                if (preview) preview.scrollTop = preview.scrollHeight;
                const editPanel = document.querySelector('#edit-panel-scroll');
                if (editPanel) editPanel.scrollTop = editPanel.scrollHeight;
            }, 50);
        },
        downloadImage(dataUrl, fileName) {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = fileName;
            a.click();
        },
        nextFrame() {
            return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        },
        waitForImageReady(img) {
            return new Promise(resolve => {
                let settled = false;
                const finish = () => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve();
                };
                const timer = setTimeout(finish, 3000);

                if (img.complete && img.naturalWidth > 0) {
                    if (img.decode) img.decode().then(finish).catch(finish);
                    else finish();
                    return;
                }

                img.addEventListener('load', finish, { once: true });
                img.addEventListener('error', finish, { once: true });
            });
        },
        async waitForExportReady(node) {
            const images = Array.from(node.querySelectorAll('img'));
            await Promise.all(images.map(img => this.waitForImageReady(img)));
            if (document.fonts?.ready) {
                await Promise.race([
                    document.fonts.ready.catch(() => {}),
                    new Promise(resolve => setTimeout(resolve, 1500))
                ]);
            }
            await this.nextFrame();
        },
        getImageSource(img) {
            const source = img.currentSrc || img.getAttribute('src') || img.src || '';
            if (!source || source.startsWith('data:') || source.startsWith('blob:')) return source;
            try {
                return new URL(source, document.baseURI).href;
            } catch (e) {
                return source;
            }
        },
        intersectRects(a, b) {
            const left = Math.max(a.left, b.left);
            const top = Math.max(a.top, b.top);
            const right = Math.min(a.right, b.right);
            const bottom = Math.min(a.bottom, b.bottom);
            if (right <= left || bottom <= top) return null;
            return { left, top, right, bottom, width: right - left, height: bottom - top };
        },
        getVisibleImageRect(img, root, imageRect, rootRect) {
            let clip = this.intersectRects(imageRect, rootRect);
            if (!clip) return null;

            for (let el = img.parentElement; el && el !== root.parentElement; el = el.parentElement) {
                const style = window.getComputedStyle(el);
                if (/(auto|scroll|hidden|clip)/.test(`${style.overflow}${style.overflowX}${style.overflowY}`)) {
                    clip = this.intersectRects(clip, el.getBoundingClientRect());
                    if (!clip) return null;
                }
                if (el === root) break;
            }

            return {
                x: clip.left - rootRect.left,
                y: clip.top - rootRect.top,
                width: clip.width,
                height: clip.height
            };
        },
        parseRadiusValue(value, width, height) {
            const token = String(value || '0').trim().split(/\s+/)[0];
            if (!token || token === '0') return 0;
            if (token.endsWith('%')) return Math.min(width, height) * parseFloat(token) / 100;
            return parseFloat(token) || 0;
        },
        readBorderRadius(style, width, height) {
            return {
                tl: this.parseRadiusValue(style.borderTopLeftRadius, width, height),
                tr: this.parseRadiusValue(style.borderTopRightRadius, width, height),
                br: this.parseRadiusValue(style.borderBottomRightRadius, width, height),
                bl: this.parseRadiusValue(style.borderBottomLeftRadius, width, height)
            };
        },
        getImageRadius(img, rect, style) {
            let radius = this.readBorderRadius(style, rect.width, rect.height);
            if (radius.tl || radius.tr || radius.br || radius.bl) return radius;

            const parent = img.parentElement;
            if (!parent) return radius;

            const parentStyle = window.getComputedStyle(parent);
            if (!/(hidden|clip)/.test(`${parentStyle.overflow}${parentStyle.overflowX}${parentStyle.overflowY}`)) {
                return radius;
            }

            const parentRect = parent.getBoundingClientRect();
            return this.readBorderRadius(parentStyle, parentRect.width, parentRect.height);
        },
        collectImageOverlays(node) {
            const rootRect = node.getBoundingClientRect();
            return Array.from(node.querySelectorAll('img')).map(img => {
                const rect = img.getBoundingClientRect();
                if (!rect.width || !rect.height) return null;

                const visibleRect = this.getVisibleImageRect(img, node, rect, rootRect);
                if (!visibleRect) return null;

                const style = window.getComputedStyle(img);
                const src = this.getImageSource(img);
                if (!src) return null;

                return {
                    src,
                    x: rect.left - rootRect.left,
                    y: rect.top - rootRect.top,
                    width: rect.width,
                    height: rect.height,
                    visibleRect,
                    naturalWidth: img.naturalWidth || rect.width,
                    naturalHeight: img.naturalHeight || rect.height,
                    objectFit: style.objectFit || 'fill',
                    objectPosition: style.objectPosition || '50% 50%',
                    opacity: parseFloat(style.opacity || '1'),
                    filter: style.filter && style.filter !== 'none' ? style.filter : 'none',
                    radius: this.getImageRadius(img, rect, style)
                };
            }).filter(Boolean);
        },
        mutePreviewImages(node) {
            const images = Array.from(node.querySelectorAll('img'));
            const states = images.map(img => ({
                img,
                exportMuted: img.getAttribute('data-export-muted'),
                visibility: img.style.visibility
            }));

            images.forEach(img => {
                img.dataset.exportMuted = '1';
                img.style.visibility = 'hidden';
            });

            return () => {
                states.forEach(({ img, exportMuted, visibility }) => {
                    if (exportMuted === null) img.removeAttribute('data-export-muted');
                    else img.setAttribute('data-export-muted', exportMuted);
                    img.style.visibility = visibility;
                });
            };
        },
        loadExportImage(src) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                if (/^https?:/i.test(src)) {
                    try {
                        if (new URL(src).origin !== window.location.origin) img.crossOrigin = 'anonymous';
                    } catch (e) {}
                }
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
            });
        },
        addRoundedRectPath(ctx, x, y, width, height, radius) {
            const tl = Math.min(radius.tl || 0, width / 2, height / 2);
            const tr = Math.min(radius.tr || 0, width / 2, height / 2);
            const br = Math.min(radius.br || 0, width / 2, height / 2);
            const bl = Math.min(radius.bl || 0, width / 2, height / 2);

            ctx.beginPath();
            ctx.moveTo(x + tl, y);
            ctx.lineTo(x + width - tr, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
            ctx.lineTo(x + width, y + height - br);
            ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
            ctx.lineTo(x + bl, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
            ctx.lineTo(x, y + tl);
            ctx.quadraticCurveTo(x, y, x + tl, y);
            ctx.closePath();
        },
        getObjectPosition(position) {
            const tokens = String(position || '').toLowerCase().split(/\s+/);
            let x = 0.5;
            let y = 0.5;
            let xSet = false;
            let ySet = false;

            tokens.forEach(token => {
                if (token === 'left') { x = 0; xSet = true; }
                else if (token === 'right') { x = 1; xSet = true; }
                else if (token === 'top') { y = 0; ySet = true; }
                else if (token === 'bottom') { y = 1; ySet = true; }
                else if (token === 'center') {}
                else if (token.endsWith('%')) {
                    const value = parseFloat(token) / 100;
                    if (!xSet) { x = value; xSet = true; }
                    else if (!ySet) { y = value; ySet = true; }
                }
            });

            return { x, y };
        },
        drawImageByObjectFit(ctx, image, overlay, x, y, width, height) {
            const fit = overlay.objectFit || 'fill';
            const imageWidth = overlay.naturalWidth || image.naturalWidth || width;
            const imageHeight = overlay.naturalHeight || image.naturalHeight || height;
            const position = this.getObjectPosition(overlay.objectPosition);

            if (fit === 'contain' || fit === 'cover' || fit === 'scale-down') {
                const containScale = Math.min(width / imageWidth, height / imageHeight);
                const coverScale = Math.max(width / imageWidth, height / imageHeight);
                let scale = fit === 'cover' ? coverScale : containScale;
                if (fit === 'scale-down') scale = Math.min(1, containScale);

                const drawWidth = imageWidth * scale;
                const drawHeight = imageHeight * scale;
                const drawX = x + (width - drawWidth) * position.x;
                const drawY = y + (height - drawHeight) * position.y;
                ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
                return;
            }

            ctx.drawImage(image, x, y, width, height);
        },
        async paintImageOverlays(baseDataUrl, node, overlays) {
            if (!overlays.length) return baseDataUrl;

            const baseImage = await this.loadExportImage(baseDataUrl);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const nodeRect = node.getBoundingClientRect();
            const scaleX = baseImage.naturalWidth / nodeRect.width;
            const scaleY = baseImage.naturalHeight / nodeRect.height;

            canvas.width = baseImage.naturalWidth;
            canvas.height = baseImage.naturalHeight;
            ctx.drawImage(baseImage, 0, 0);

            for (const overlay of overlays) {
                try {
                    const image = await this.loadExportImage(overlay.src);
                    const x = overlay.x * scaleX;
                    const y = overlay.y * scaleY;
                    const width = overlay.width * scaleX;
                    const height = overlay.height * scaleY;
                    const clip = overlay.visibleRect;
                    const radius = {
                        tl: (overlay.radius.tl || 0) * Math.min(scaleX, scaleY),
                        tr: (overlay.radius.tr || 0) * Math.min(scaleX, scaleY),
                        br: (overlay.radius.br || 0) * Math.min(scaleX, scaleY),
                        bl: (overlay.radius.bl || 0) * Math.min(scaleX, scaleY)
                    };

                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(clip.x * scaleX, clip.y * scaleY, clip.width * scaleX, clip.height * scaleY);
                    ctx.clip();
                    this.addRoundedRectPath(ctx, x, y, width, height, radius);
                    ctx.clip();
                    ctx.globalAlpha = Number.isFinite(overlay.opacity) ? overlay.opacity : 1;
                    try { ctx.filter = overlay.filter || 'none'; } catch (e) { ctx.filter = 'none'; }
                    this.drawImageByObjectFit(ctx, image, overlay, x, y, width, height);
                    ctx.restore();
                } catch (e) {
                    console.warn('Image overlay paint failed', overlay.src, e);
                }
            }

            return canvas.toDataURL('image/png');
        },
        async createExportImageDataUrl() {
            const node = document.getElementById('wechat-preview');
            if (!node) throw new Error('Preview node not found');

            const imageApi = typeof htmlToImage !== 'undefined' ? htmlToImage : (window.htmlToImage || null);
            if (!imageApi?.toPng) throw new Error('Image generator is not loaded');

            let restoreImages = null;
            try {
                await this.waitForExportReady(node);
                const imageOverlays = this.collectImageOverlays(node);
                restoreImages = this.mutePreviewImages(node);
                await this.nextFrame();

                const dataUrl = await imageApi.toPng(node, {
                    pixelRatio: 3,
                    backgroundColor: this.isDarkMode ? '#111111' : '#ededed',
                    cacheBust: true,
                    imagePlaceholder: exportTransparentPixel,
                    style: { transform: 'scale(1)', transformOrigin: 'top left' }
                });
                const finalDataUrl = await this.paintImageOverlays(dataUrl, node, imageOverlays);
                await this.ensureGeneratedImageDecoded(finalDataUrl);
                return finalDataUrl;
            } finally {
                if (restoreImages) restoreImages();
            }
        },
        ensureGeneratedImageDecoded(dataUrl) {
            return new Promise((resolve, reject) => {
                const image = new Image();
                let settled = false;
                const done = () => {
                    if (settled) return;
                    settled = true;
                    resolve();
                };
                image.onload = done;
                image.onerror = reject;
                image.src = dataUrl;
                if (image.decode) image.decode().then(done).catch(() => {});
            });
        },
        async generatePreparedImage(event) {
            const btn = event?.currentTarget;
            const originalText = btn?.innerHTML;
            if (btn) btn.innerHTML = '正在生成...';
            this.activePage = 'preview';
            this.generatedImagePanelVisible = true;
            this.generatedImageStatus = '正在生成最终图片...';

            try {
                let dataUrl = '';
                let lastError = null;
                for (let attempt = 0; attempt < 3; attempt += 1) {
                    try {
                        if (attempt > 0) {
                            this.generatedImageStatus = `正在重新生成(${attempt + 1}/3)...`;
                            await new Promise(resolve => setTimeout(resolve, 360));
                        }
                        dataUrl = await this.createExportImageDataUrl();
                        break;
                    } catch (error) {
                        lastError = error;
                    }
                }

                if (!dataUrl) throw lastError || new Error('Image generation failed');

                this.generatedImageUrl = dataUrl;
                this.generatedImageDirty = false;
                this.generatedImageStatus = this.supportsFileShare
                    ? '已生成。请确认缩略图完整，然后下载或使用系统分享。'
                    : '已生成。请确认缩略图完整，然后下载图片。';
            } catch (error) {
                console.error('生成图片失败!', error);
                this.generatedImageStatus = '生成失败，请重试';
                alert('图片生成失败，请重试');
            } finally {
                if (btn && originalText != null) btn.innerHTML = originalText;
            }
        },
        ensureGeneratedImageReady() {
            if (!this.generatedImageUrl || this.generatedImageDirty) {
                this.activePage = 'preview';
                this.generatedImagePanelVisible = true;
                const message = this.generatedImageDirty
                    ? '内容已经变化，请先重新生成图片，再下载或分享。'
                    : '请先点击“生成图片”，确认最终图完整后再下载或分享。';
                this.generatedImageStatus = message;
                alert(message);
                return false;
            }
            return true;
        },
        getGeneratedImageFileName() {
            return `微信截图_${new Date().getTime()}.png`;
        },
        async createGeneratedImageFile(fileName = this.getGeneratedImageFileName()) {
            const response = await fetch(this.generatedImageUrl);
            if (!response.ok) throw new Error('无法读取已生成图片');
            return new File([await response.blob()], fileName, { type: 'image/png' });
        },
        async downloadGeneratedImage(event) {
            if (!this.ensureGeneratedImageReady()) return;

            const btn = event?.currentTarget;
            const originalText = btn?.innerHTML;
            if (btn) btn.innerHTML = '正在下载...';

            try {
                this.downloadImage(this.generatedImageUrl, this.getGeneratedImageFileName());
                this.generatedImageStatus = '图片下载已触发；如未出现文件，请检查浏览器下载权限。';
            } catch (error) {
                console.error('下载失败!', error);
                alert('图片下载失败，请重试');
            } finally {
                if (btn && originalText != null) btn.innerHTML = originalText;
            }
        },
        async shareGeneratedImage(event) {
            if (!this.ensureGeneratedImageReady()) return;
            if (!this.supportsFileShare) {
                alert('当前浏览器不支持文件分享，请使用“下载图片”。');
                return;
            }

            const btn = event?.currentTarget;
            const originalText = btn?.innerHTML;
            if (btn) btn.innerHTML = '正在分享...';

            try {
                const file = await this.createGeneratedImageFile();
                await navigator.share({
                    files: [file],
                    title: file.name,
                    text: '微信截图'
                });
                this.generatedImageStatus = '已交给系统分享。';
            } catch (error) {
                if (error?.name === 'AbortError') {
                    this.generatedImageStatus = '已取消系统分享。';
                    return;
                }
                console.error('分享失败!', error);
                alert('系统分享失败，请改用“下载图片”。');
            } finally {
                if (btn && originalText != null) btn.innerHTML = originalText;
            }
        }
    }
}).mount('#app');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(error => {
            console.warn('Service worker 注册失败。', error);
        });
    });
}
