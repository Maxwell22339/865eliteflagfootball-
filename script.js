        // --- Helper: compress image data URL to reduce localStorage usage ---
        function compressImageDataUrl(dataUrl, maxWidth, maxHeight, quality) {
            maxWidth = maxWidth || 800;
            maxHeight = maxHeight || 800;
            quality = quality || 0.7;
            return new Promise(function(resolve) {
                var img = new Image();
                img.onload = function() {
                    var w = img.width, h = img.height;
                    if (w > maxWidth || h > maxHeight) {
                        var ratio = Math.min(maxWidth / w, maxHeight / h);
                        w = Math.round(w * ratio);
                        h = Math.round(h * ratio);
                    }
                    var canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = function() { resolve(dataUrl); };
                img.src = dataUrl;
            });
        }

        function toBooleanStateValue(value) {
            if (value === true || value === 1) return true;
            var normalized = String(value || '').trim().toLowerCase();
            return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
        }

        function isSiteLogoOverrideEnabled() {
            try {
                return toBooleanStateValue(localStorage.getItem(SITE_LOGO_OVERRIDE_FLAG_KEY));
            } catch (err) {
                return false;
            }
        }

        // --- Helper: safe localStorage setter with quota handling ---
        function safeLocalStorageSet(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (e) {
                if (e.name === 'QuotaExceededError' || e.code === 22) {
                    alert('Storage is full. Please clear some data (old documents or images) to free up space.');
                } else {
                    alert('Unable to save data to browser storage. You may be in private browsing mode.');
                }
                return false;
            }
        }

        // --- IndexedDB helpers (for large binary items: images, documents, page HTML) ---
        var _idbPromise = null;
        function openIDB() {
            if (_idbPromise) return _idbPromise;
            _idbPromise = new Promise(function(resolve, reject) {
                var req = indexedDB.open('eliteFF_db', 1);
                req.onupgradeneeded = function(e) { e.target.result.createObjectStore('blobs'); };
                req.onsuccess = function(e) { resolve(e.target.result); };
                req.onerror = function(e) { _idbPromise = null; reject(e.target.error); };
            });
            return _idbPromise;
        }
        function idbGet(key) {
            return openIDB().then(function(db) {
                return new Promise(function(resolve) {
                    var req = db.transaction('blobs', 'readonly').objectStore('blobs').get(key);
                    req.onsuccess = function(e) { resolve(e.target.result); };
                    req.onerror = function() { resolve(undefined); };
                });
            }).catch(function() { return undefined; });
        }
        function idbSet(key, value) {
            return openIDB().then(function(db) {
                return new Promise(function(resolve, reject) {
                    var req = db.transaction('blobs', 'readwrite').objectStore('blobs').put(value, key);
                    req.onsuccess = function() { resolve(true); };
                    req.onerror = function(e) { reject(e.target.error); };
                });
            }).catch(function() { return false; });
        }
        function idbDelete(key) {
            return openIDB().then(function(db) {
                return new Promise(function(resolve) {
                    var req = db.transaction('blobs', 'readwrite').objectStore('blobs').delete(key);
                    req.onsuccess = function() { resolve(true); };
                    req.onerror = function() { resolve(false); };
                });
            }).catch(function() { return false; });
        }

        // --- One-time migration: move large items from localStorage to IndexedDB ---
        function migrateLocalStorageToIDB() {
            if (localStorage.getItem('idb_migrated_v1')) return Promise.resolve();
            var keys = [SITE_LOGO_KEY, HOME_HERO_BACKGROUND_KEY, PAGE_CONTENT_KEY, 'documents'];
            var promises = keys.map(function(k) {
                try {
                    var val = localStorage.getItem(k);
                    if (!val) return Promise.resolve();
                    var parsed = k === 'documents' ? JSON.parse(val) : val;
                    return idbSet(k, parsed).then(function() { localStorage.removeItem(k); });
                } catch (e) { return Promise.resolve(); }
            });
            return Promise.all(promises).then(function() {
                try { localStorage.setItem('idb_migrated_v1', '1'); } catch (e) {}
            });
        }

        // --- Admin accounts ---
        const ADMIN_ACCOUNTS = [
            { username: 'TFick123', password: 'IowaTennessee' },
            { username: 'Maxwell22339', password: 'Daush+1115' }
        ];
        const PAGE_CONTENT_KEY = 'siteContentHTML_v4';
        const PAGE_CONTENT_VERSION_KEY = 'siteContentVersion_v1';
        const PAGE_CONTENT_TEMPLATE_VERSION = '20260612_signup_v3';
        const SITE_LOGO_KEY = 'siteLogoDataUrl_v1';
        const SITE_LOGO_OVERRIDE_FLAG_KEY = 'siteLogoOverrideEnabled_v1';
        const LOGO_CACHE_VERSION_KEY = 'logoCacheVersion_v1';
        const LOGO_CACHE_VERSION = '20260530_logo_refresh_v1';
        const HOME_HERO_BACKGROUND_KEY = 'homeHeroBackgroundDataUrl_v1';
        const CTA_BUTTON_KEY = 'heroCtaButton_v1';
        const DEFAULT_PAYPAL_URL = 'https://paypal.me/tfick123';
        const DEFAULT_ADMIN_NOTIFICATION_EMAIL = '865eliteflagfootball@gmail.com';
        const DEFAULT_CASHAPP_URL = 'https://cash.app/$Tfick123';
        const DEFAULT_VENMO_URL = 'https://venmo.com/u/Tfick123';
        const PAYMENT_LINKS_KEY = 'paypalPaymentLinks_v1';
        const PAYMENT_REQUESTS_KEY = 'paymentRequests';
        const PAYMENT_NOTIFICATION_SETTINGS_KEY = 'paymentNotificationSettings_v1';
        const SIGNUP_SEASON_SETTINGS_KEY = 'signupSeasonSettings_v1';
        let PAYMENT_LINKS = {
            team: DEFAULT_PAYPAL_URL,
            freeAgent: DEFAULT_PAYPAL_URL,
            cashApp: DEFAULT_CASHAPP_URL,
            venmo: DEFAULT_VENMO_URL
        };
        let PAYMENT_NOTIFICATION_SETTINGS = {
            adminEmail: DEFAULT_ADMIN_NOTIFICATION_EMAIL,
            publicKey: '',
            serviceId: 'service_sp3bqul',
            templateId: ''
        };
        const REGISTRATION_TYPE_LABELS = {
            freeAgent: 'Free Agent ($50)',
            teamHasJerseys: 'Team — Has Jerseys ($350)',
            teamNeedsJerseys: 'Team — Needs Jerseys ($500)',
            team: 'Team Registration ($500)'
        };
        function isTeamRegistrationType(type) {
            return type === 'teamHasJerseys' || type === 'teamNeedsJerseys' || type === 'team';
        }
        const SUPABASE_PUBLIC_STATE_KEYS = {
            pageContent: 'page_content',
            pageContentVersion: 'page_content_version',
            siteLogo: 'site_logo',
            siteLogoOverrideEnabled: 'site_logo_override_enabled',
            homeHeroBackground: 'home_hero_background',
            ctaButton: 'cta_button',
            paymentLinks: 'payment_links',
            paymentNotificationSettings: 'payment_notification_settings',
            signupSeason: 'signup_season',
            members: 'members',
            documents: 'documents',
            countdown: 'countdown',
            leagueStandings: 'league_standings',
            leagueSchedule: 'league_schedule',
            offensiveStats: 'offensive_stats',
            defensiveStats: 'defensive_stats',
            recapOffensiveStats: 'recap_offensive_stats',
            recapDefensiveStats: 'recap_defensive_stats',
            statsTeamLogos: 'stats_team_logos',
            currentSeasonLabel: 'current_season_label',
            recapSeasonLabel: 'recap_season_label',
            seasonArchives: 'season_archives',
            selectedSeasonArchiveId: 'selected_season_archive_id',
            playoffBracket: 'playoff_bracket',
            heroBgPosition: 'hero_bg_position'
        };
        const ADMIN_MANAGED_PUBLIC_STATE_KEYS = Object.keys(SUPABASE_PUBLIC_STATE_KEYS).map(function(name) {
            return SUPABASE_PUBLIC_STATE_KEYS[name];
        });
        const PUBLIC_SHARED_STATE_REFRESH_INTERVAL_MS = 30000;
        var siteSupabaseClient = null;
        var siteSupabaseInitialized = false;
        var paymentRequestsState = [];
        var membersState = null;
        var documentsState = [];
        var sharedPublicStateFingerprint = '';
        var sharedPublicStateRefreshTimer = null;

        function getSiteSupabaseConfig() {
            var config = window.__865EliteSupabaseConfig || {};
            return {
                url: String(config.url || '').trim(),
                anonKey: String(config.anonKey || '').trim(),
                stateTable: String(config.stateTable || config.dataTable || 'site_content').trim(),
                registrationsTable: String(config.registrationsTable || config.signupsTable || 'signup_submissions').trim(),
                galleryImagesTable: String(config.galleryImagesTable || 'gallery_images').trim(),
                galleryBucket: String(config.galleryBucket || 'gallery-images').trim(),
                documentsBucket: String(config.documentsBucket || config.galleryBucket || 'gallery-images').trim(),
                galleryKey: String(config.galleryKey || 'gallery').trim(),
                paymentRequestsKey: String(config.paymentRequestsKey || 'payment_requests').trim()
            };
        }

        function isLocalPreviewMode() {
            var host = String(window.location.hostname || '').toLowerCase();
            return window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
        }

        function isAdminManagedPublicStateKey(stateKey) {
            return ADMIN_MANAGED_PUBLIC_STATE_KEYS.indexOf(stateKey) !== -1;
        }

        function buildSharedPublicStateFingerprint(rows) {
            if (!Array.isArray(rows)) return '';
            return JSON.stringify(rows.map(function(row) {
                return {
                    key: row && row.key ? row.key : '',
                    value: row ? row.value : null
                };
            }).sort(function(a, b) {
                return a.key.localeCompare(b.key);
            }));
        }

        function shouldLogSharedPublicPersistWarning(result) {
            return (!result || !result.saved) && !(result && result.blocked);
        }

        function publicVisitorHasActiveFormInteraction() {
            var active = document.activeElement;
            if (!active || typeof active.closest !== 'function') return false;
            // Include standalone controls as well as form descendants because some
            // signup/login actions on the page are rendered outside a <form>.
            return !!active.closest('form, input, textarea, select, button');
        }

        function logSupabaseOperation(scope, level, message, details) {
            var method = console[level] || console.log;
            if (details === undefined) method.call(console, '[' + scope + '][Supabase] ' + message);
            else method.call(console, '[' + scope + '][Supabase] ' + message, details);
        }

        function logSupabaseRlsHint(scope, error) {
            var details = String((error && (error.message || error.details || error.hint)) || '').toLowerCase();
            if (details.indexOf('row-level security') !== -1 || details.indexOf('rls') !== -1 || details.indexOf('permission denied') !== -1) {
                console.error('[' + scope + '][Supabase][RLS] Check public SELECT plus required INSERT/UPDATE policies.', error || '');
            }
        }

        function getSiteSupabaseClient() {
            if (siteSupabaseInitialized) return siteSupabaseClient;
            siteSupabaseInitialized = true;
            var config = getSiteSupabaseConfig();
            if (!config.url || !config.anonKey) {
                logSupabaseOperation('Core', 'error', 'Missing Supabase URL or anon key in window.__865EliteSupabaseConfig.');
                return null;
            }
            if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                logSupabaseOperation('Core', 'error', 'Supabase browser client library failed to load.');
                return null;
            }
            siteSupabaseClient = window.supabase.createClient(config.url, config.anonKey);
            logSupabaseOperation('Core', 'info', 'Supabase client initialized.', {
                url: config.url,
                stateTable: config.stateTable,
                registrationsTable: config.registrationsTable,
                galleryImagesTable: config.galleryImagesTable,
                galleryBucket: config.galleryBucket,
                documentsBucket: config.documentsBucket
            });
            return siteSupabaseClient;
        }

        async function clearProductionPublicStateMirrors() {
            var localKeys = [
                PAGE_CONTENT_KEY,
                PAGE_CONTENT_VERSION_KEY,
                SITE_LOGO_KEY,
                HOME_HERO_BACKGROUND_KEY,
                CTA_BUTTON_KEY,
                PAYMENT_LINKS_KEY,
                PAYMENT_NOTIFICATION_SETTINGS_KEY,
                SIGNUP_SEASON_SETTINGS_KEY,
                'members',
                'countdownDate_v1',
                'leagueStandings_v1',
                'leagueSchedule_v1',
                'offensivePlayerStats_v1',
                'defensivePlayerStats_v1',
                'recapOffensivePlayerStats_v1',
                'recapDefensivePlayerStats_v1',
                'statsTeamLogos_v1',
                'currentSeasonLabel_v1',
                'recapSeasonLabel_v1',
                'seasonArchives_v1',
                'selectedSeasonArchive_v1',
                'playoffBracket_v1',
                'galleryMeta_v1',
                PAYMENT_REQUESTS_KEY,
                SUPABASE_PUBLIC_STATE_KEYS.siteLogo,
                SITE_LOGO_OVERRIDE_FLAG_KEY,
                SUPABASE_PUBLIC_STATE_KEYS.siteLogoOverrideEnabled
            ];
            localKeys.forEach(function(key) {
                try { localStorage.removeItem(key); } catch (err) {}
            });
            await Promise.all([
                idbDelete(PAGE_CONTENT_KEY),
                idbDelete(SITE_LOGO_KEY),
                idbDelete(HOME_HERO_BACKGROUND_KEY),
                idbDelete('documents')
            ]);
            paymentRequestsState = [];
            membersState = null;
            documentsState = [];
        }

        function getStoredPageContentVersion() {
            try {
                var raw = localStorage.getItem(PAGE_CONTENT_VERSION_KEY);
                return raw ? String(raw).trim() : '';
            } catch (err) {
                return '';
            }
        }

        async function fetchSharedPublicStateFromSupabase() {
            var client = getSiteSupabaseClient();
            if (!client) return null;
            var config = getSiteSupabaseConfig();
            var keys = Object.keys(SUPABASE_PUBLIC_STATE_KEYS).map(function(name) { return SUPABASE_PUBLIC_STATE_KEYS[name]; });
            try {
                var response = await client
                    .from(config.stateTable)
                    .select('key, value')
                    .in('key', keys);
                if (response.error) {
                    logSupabaseOperation('SharedState', 'error', 'SELECT error while hydrating shared public state.', response.error);
                    logSupabaseRlsHint('SharedState', response.error);
                    return null;
                }
                var rows = Array.isArray(response.data) ? response.data : [];
                logSupabaseOperation('SharedState', 'info', 'SELECT success while hydrating shared public state.', { rows: rows.length });
                return rows;
            } catch (err) {
                logSupabaseOperation('SharedState', 'error', 'Unexpected SELECT failure while hydrating shared public state.', err);
                logSupabaseRlsHint('SharedState', err);
                return null;
            }
        }

        async function persistSharedPublicStateToSupabase(stateKey, value, scope) {
            // Local preview intentionally skips remote persistence so admins can test
            // editing flows without a live Supabase write target.
            if (isLocalPreviewMode()) return { saved: true, blocked: false };
            if (isAdminManagedPublicStateKey(stateKey) && !isAdminLoggedIn()) {
                logSupabaseOperation(scope || 'SharedState', 'warn', 'Blocked non-admin attempt to publish key "' + stateKey + '".');
                return { saved: false, blocked: true };
            }
            var client = getSiteSupabaseClient();
            if (!client) return { saved: false, blocked: false };
            var config = getSiteSupabaseConfig();
            try {
                var response = await client
                    .from(config.stateTable)
                    .upsert({ key: stateKey, value: value }, { onConflict: 'key' });
                if (response.error) {
                    logSupabaseOperation(scope || 'SharedState', 'error', 'INSERT/UPDATE error for key "' + stateKey + '".', response.error);
                    logSupabaseRlsHint(scope || 'SharedState', response.error);
                    return { saved: false, blocked: false };
                }
                logSupabaseOperation(scope || 'SharedState', 'info', 'INSERT/UPDATE success for key "' + stateKey + '".');
                return { saved: true, blocked: false };
            } catch (err) {
                logSupabaseOperation(scope || 'SharedState', 'error', 'Unexpected INSERT/UPDATE failure for key "' + stateKey + '".', err);
                logSupabaseRlsHint(scope || 'SharedState', err);
                return { saved: false, blocked: false };
            }
        }

        function queueSharedPublicStatePersist(stateKey, value, scope) {
            return persistSharedPublicStateToSupabase(stateKey, value, scope).then(function(result) {
                if (shouldLogSharedPublicPersistWarning(result) && !isLocalPreviewMode()) {
                    logSupabaseOperation(scope || 'SharedState', 'warn', 'Production data did not persist to Supabase for key "' + stateKey + '".');
                }
                return !!(result && result.saved);
            });
        }

        async function hydrateSharedPublicStateFromSupabase() {
            if (isLocalPreviewMode()) return false;
            // Snapshot existing hero background from IndexedDB BEFORE clearing, so we
            // can fall back to the local cache if Supabase does not return that key.
            var existingBg = null;
            try { existingBg = await idbGet(HOME_HERO_BACKGROUND_KEY); } catch (err) {}

            // Snapshot existing logo state BEFORE clearing local mirrors so we can fall back
            // to the locally-cached logo if Supabase does not have the key (e.g. a prior write
            // was blocked by RLS or failed transiently).
            var existingLogo = null;
            var existingLogoOverrideEnabled = false;
            try {
                existingLogoOverrideEnabled = isSiteLogoOverrideEnabled();
                existingLogo = await idbGet(SITE_LOGO_KEY);
            } catch (err) {}

            // Fetch from Supabase BEFORE clearing local mirrors so that a transient
            // network error or RLS failure does not wipe locally-cached data.
            var rows = await fetchSharedPublicStateFromSupabase();
            if (rows === null) return false;
            sharedPublicStateFingerprint = buildSharedPublicStateFingerprint(rows);
            await clearProductionPublicStateMirrors();
            var valueByKey = rows.reduce(function(acc, row) {
                if (row && row.key) acc[row.key] = row.value;
                return acc;
            }, {});
            // hasKey helper: check that a key exists in the response (value may be falsy).
            function hasKey(k) { return Object.prototype.hasOwnProperty.call(valueByKey, k); }
            var logoOverrideEnabled = hasKey(SUPABASE_PUBLIC_STATE_KEYS.siteLogoOverrideEnabled)
                ? toBooleanStateValue(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.siteLogoOverrideEnabled])
                : false;
            try {
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.pageContent) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.pageContent]) await idbSet(PAGE_CONTENT_KEY, String(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.pageContent] || ''));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.homeHeroBackground) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.homeHeroBackground]) {
                    await idbSet(HOME_HERO_BACKGROUND_KEY, String(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.homeHeroBackground] || ''));
                } else if (existingBg) {
                    // Same fallback for the hero background.
                    await idbSet(HOME_HERO_BACKGROUND_KEY, existingBg);
                }
                if (logoOverrideEnabled && hasKey(SUPABASE_PUBLIC_STATE_KEYS.siteLogo) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.siteLogo]) {
                    // Supabase has valid logo data — use it as the source of truth.
                    await idbSet(SITE_LOGO_KEY, String(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.siteLogo] || ''));
                } else if (existingLogoOverrideEnabled && existingLogo) {
                    // Supabase is missing or has incomplete logo data but we have a
                    // locally-cached admin-uploaded logo.  Preserve it so the admin's
                    // branding change survives page reloads until Supabase is updated.
                    await idbSet(SITE_LOGO_KEY, existingLogo);
                    logoOverrideEnabled = true;
                } else {
                    await idbDelete(SITE_LOGO_KEY);
                }
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.documents)) {
                    documentsState = Array.isArray(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.documents]) ? valueByKey[SUPABASE_PUBLIC_STATE_KEYS.documents] : [];
                    await idbSet('documents', documentsState);
                }
            } catch (err) {
                logSupabaseOperation('SharedState', 'error', 'Failed mirroring IndexedDB-backed public state.', err);
            }
            try {
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.pageContentVersion) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.pageContentVersion] != null) {
                    localStorage.setItem(PAGE_CONTENT_VERSION_KEY, String(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.pageContentVersion] || ''));
                } else {
                    localStorage.removeItem(PAGE_CONTENT_VERSION_KEY);
                }
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.siteLogoOverrideEnabled) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.siteLogoOverrideEnabled] != null) {
                    localStorage.setItem(SITE_LOGO_OVERRIDE_FLAG_KEY, logoOverrideEnabled ? '1' : '0');
                } else if (logoOverrideEnabled) {
                    // We fell back to the locally-cached logo — make sure the flag matches.
                    localStorage.setItem(SITE_LOGO_OVERRIDE_FLAG_KEY, '1');
                } else {
                    localStorage.removeItem(SITE_LOGO_OVERRIDE_FLAG_KEY);
                }
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.ctaButton) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.ctaButton] != null) localStorage.setItem(CTA_BUTTON_KEY, JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.ctaButton]));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.paymentLinks) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.paymentLinks] != null) localStorage.setItem(PAYMENT_LINKS_KEY, JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.paymentLinks]));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.paymentNotificationSettings) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.paymentNotificationSettings] != null) localStorage.setItem(PAYMENT_NOTIFICATION_SETTINGS_KEY, JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.paymentNotificationSettings]));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.signupSeason) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.signupSeason] != null) localStorage.setItem(SIGNUP_SEASON_SETTINGS_KEY, JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.signupSeason]));
                else if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.signupSeason)) localStorage.removeItem(SIGNUP_SEASON_SETTINGS_KEY);
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.countdown) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.countdown] != null) localStorage.setItem('countdownDate_v1', JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.countdown]));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.leagueStandings) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.leagueStandings] != null) localStorage.setItem('leagueStandings_v1', JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.leagueStandings]));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.leagueSchedule) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.leagueSchedule] != null) localStorage.setItem('leagueSchedule_v1', JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.leagueSchedule]));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.offensiveStats) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.offensiveStats] != null) localStorage.setItem('offensivePlayerStats_v1', JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.offensiveStats]));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.defensiveStats) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.defensiveStats] != null) localStorage.setItem('defensivePlayerStats_v1', JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.defensiveStats]));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.recapOffensiveStats) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.recapOffensiveStats] != null) localStorage.setItem('recapOffensivePlayerStats_v1', JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.recapOffensiveStats]));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.recapDefensiveStats) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.recapDefensiveStats] != null) localStorage.setItem('recapDefensivePlayerStats_v1', JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.recapDefensiveStats]));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.statsTeamLogos) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.statsTeamLogos] != null) localStorage.setItem('statsTeamLogos_v1', JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.statsTeamLogos]));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.currentSeasonLabel) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.currentSeasonLabel] != null) localStorage.setItem('currentSeasonLabel_v1', String(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.currentSeasonLabel] || ''));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.recapSeasonLabel) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.recapSeasonLabel] != null) localStorage.setItem('recapSeasonLabel_v1', String(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.recapSeasonLabel] || ''));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.seasonArchives) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.seasonArchives] != null) localStorage.setItem('seasonArchives_v1', JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.seasonArchives]));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.selectedSeasonArchiveId) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.selectedSeasonArchiveId] != null) localStorage.setItem('selectedSeasonArchive_v1', String(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.selectedSeasonArchiveId] || ''));
                if (hasKey(SUPABASE_PUBLIC_STATE_KEYS.playoffBracket) && valueByKey[SUPABASE_PUBLIC_STATE_KEYS.playoffBracket] != null) localStorage.setItem('playoffBracket_v1', JSON.stringify(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.playoffBracket]));
                if (hasKey('hero_bg_position') && valueByKey['hero_bg_position'] != null) {
                    localStorage.setItem('heroBgPosition_v1', String(valueByKey['hero_bg_position'] || 'center'));
                    var hero = document.querySelector('.hero');
                    if (hero) hero.style.setProperty('--hero-bg-position', String(valueByKey['hero_bg_position'] || 'center'));
                }
                membersState = Array.isArray(valueByKey[SUPABASE_PUBLIC_STATE_KEYS.members]) ? valueByKey[SUPABASE_PUBLIC_STATE_KEYS.members] : [];
            } catch (err) {
                logSupabaseOperation('SharedState', 'error', 'Failed mirroring localStorage-backed public state.', err);
            }
            return true;
        }

        async function refreshSharedPublicStateForPublicView() {
            // Admins are the source of truth for edits, so only public visitors use
            // the passive refresh loop to pick up newly-published content.
            if (isLocalPreviewMode() || isAdminLoggedIn()) return false;
            var rows = await fetchSharedPublicStateFromSupabase();
            if (rows === null) return false;
            var nextFingerprint = buildSharedPublicStateFingerprint(rows);
            if (!sharedPublicStateFingerprint) {
                sharedPublicStateFingerprint = nextFingerprint;
                return false;
            }
            if (nextFingerprint && nextFingerprint !== sharedPublicStateFingerprint) {
                if (publicVisitorHasActiveFormInteraction()) return false;
                // A full reload is intentional here because shared admin saves can
                // replace large sections of #siteContent and need the normal boot
                // sequence to restore the public read-only view safely.
                window.location.reload();
                return true;
            }
            return false;
        }

        function startSharedPublicStateRefreshLoop() {
            if (sharedPublicStateRefreshTimer) window.clearInterval(sharedPublicStateRefreshTimer);
            if (isLocalPreviewMode()) return;
            sharedPublicStateRefreshTimer = window.setInterval(function() {
                refreshSharedPublicStateForPublicView();
            }, PUBLIC_SHARED_STATE_REFRESH_INTERVAL_MS);
        }

        // ---- Page navigation (SPA-style) ----
        const ALL_PAGE_IDS = ['home','about','standings','leagueSchedule','player-stats','season-recap','payments',
            'documentsAdmin','documentsPublic','guestArea','myProfile','contact','gallery','playoff','faq'];
        const NAV_PAGE_OPTIONS = [
            { id: 'home', label: 'Home' },
            { id: 'about', label: 'About' },
            { id: 'standings', label: 'League Standings' },
            { id: 'leagueSchedule', label: 'League Schedule' },
            { id: 'playoff', label: 'Playoff Bracket' },
            { id: 'player-stats', label: 'Season Stats' },
            { id: 'season-recap', label: 'Season Recap' },
            { id: 'gallery', label: 'Gallery' },
            { id: 'payments', label: 'Sign Up' },
            { id: 'documentsPublic', label: 'Documents' },
            { id: 'faq', label: 'FAQ' },
            { id: 'contact', label: 'Contact' },
            { id: 'myProfile', label: 'My Profile', requiresMember: true },
            { id: 'documentsAdmin', label: 'Admin Dashboard', requiresAdmin: true }
        ];

        function isAdminLoggedIn() {
            return sessionStorage.getItem('adminLoggedIn') === 'true';
        }

        function getMatchingAdminAccount(username, password) {
            return ADMIN_ACCOUNTS.find(function(account) {
                return account.username === username && account.password === password;
            }) || null;
        }

        function clearAdminSession() {
            sessionStorage.removeItem('adminLoggedIn');
            sessionStorage.removeItem('adminUsername');
        }

        function resetToPublicView(activePageId) {
            clearAdminSession();
            lockdownForPublic();
            if (renderAllStats) renderAllStats();
            updateFooterAdminState();
            updateNavQuickSelectOptions(activePageId || (window.location.hash ? window.location.hash.substring(1) : 'home'));
            ensureNavHamburger();
            updateHeaderScrollState();
        }

        function showAdminAuthNotice(message) {
            const footerMsg = document.getElementById('footerAdminLoginMsg');
            if (footerMsg) {
                footerMsg.style.color = '#ffb366';
                footerMsg.textContent = message || '';
            }
            const modalMsg = document.getElementById('loginError');
            if (modalMsg) {
                modalMsg.style.color = '#ff6f61';
                modalMsg.textContent = message || '';
            }
        }

        function isMemberLoggedIn() {
            return sessionStorage.getItem('memberLoggedIn') === 'true';
        }

        function canAccessPage(id) {
            const adminOnlyPages = ['documentsAdmin'];
            const memberOnlyPages = ['myProfile', 'guestArea'];

            if (adminOnlyPages.indexOf(id) !== -1) {
                return isAdminLoggedIn();
            }

            if (memberOnlyPages.indexOf(id) !== -1) {
                return isMemberLoggedIn();
            }

            return true;
        }

        function getAvailableNavOptions() {
            return NAV_PAGE_OPTIONS.filter(function(option) {
                if (option.requiresAdmin && !isAdminLoggedIn()) return false;
                if (option.requiresMember && !isMemberLoggedIn()) return false;
                return true;
            });
        }

        function syncNavQuickSelect(activePageId) {
            const navSelect = document.getElementById('navQuickSelect');
            if (!navSelect) return;
            const value = activePageId || (window.location.hash ? window.location.hash.substring(1) : 'home');
            if (Array.from(navSelect.options).some(function(option) { return option.value === value; })) {
                navSelect.value = value;
            }
        }

        function updateNavQuickSelectOptions(activePageId) {
            const navSelect = document.getElementById('navQuickSelect');
            if (!navSelect) return;
            const currentValue = activePageId || navSelect.value || (window.location.hash ? window.location.hash.substring(1) : 'home');
            navSelect.innerHTML = '';
            getAvailableNavOptions().forEach(function(option) {
                const el = document.createElement('option');
                el.value = option.id;
                el.textContent = option.label;
                navSelect.appendChild(el);
            });
            syncNavQuickSelect(currentValue);
        }

        function setNavQuickSelectOpen(forceState) {
            const panel = document.getElementById('navQuickSelectPanel');
            const hamburger = document.getElementById('navHamburger');
            if (!panel || !hamburger) return;
            const isHidden = panel.classList.contains('hidden');
            const shouldOpen = typeof forceState === 'boolean' ? forceState : isHidden;
            panel.classList.toggle('hidden', !shouldOpen);
            panel.style.display = shouldOpen ? 'block' : 'none';
            panel.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
            hamburger.textContent = shouldOpen ? '\u2715' : '\u2630';
            hamburger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
            if (shouldOpen) syncNavQuickSelect();
        }

        function updateFooterAdminState() {
            const form = document.getElementById('footerAdminLoginForm');
            const session = document.getElementById('footerAdminSession');
            const name = document.getElementById('footerAdminName');
            const message = document.getElementById('footerAdminLoginMsg');
            const username = sessionStorage.getItem('adminUsername') || '';
            if (form) form.style.display = isAdminLoggedIn() ? 'none' : 'grid';
            if (session) {
                session.style.display = isAdminLoggedIn() ? 'block' : 'none';
                session.classList.toggle('hidden', !isAdminLoggedIn());
            }
            if (name) name.textContent = username;
            if (message && !isAdminLoggedIn()) {
                message.style.color = '#ffb366';
                message.textContent = '';
            }
        }

        function populateFooterAdminSelector() {
            const selector = document.getElementById('footerAdminUsername');
            if (!selector) return;
            const selectedValue = selector.value;
            selector.innerHTML = '';

            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select Admin';
            placeholder.disabled = true;
            selector.appendChild(placeholder);

            ADMIN_ACCOUNTS.forEach(function(account) {
                const option = document.createElement('option');
                option.value = account.username;
                option.textContent = account.username;
                selector.appendChild(option);
            });

            if (selectedValue && ADMIN_ACCOUNTS.some(function(account) { return account.username === selectedValue; })) {
                selector.value = selectedValue;
            } else {
                selector.value = '';
                placeholder.selected = true;
            }
        }

        function showPage(id) {
            if (id && id.startsWith('#')) id = id.substring(1);
            if (ALL_PAGE_IDS.indexOf(id) === -1 || !canAccessPage(id)) {
                id = 'home';
            }
            ALL_PAGE_IDS.forEach(function(pageId) {
                var el = document.getElementById(pageId);
                if (el) el.style.display = 'none';
            });
            var target = document.getElementById(id);
            if (target) {
                target.style.display = 'block';
                // Ensure reveal animation classes are applied so section is visible
                if (target.classList.contains('reveal') || target.classList.contains('reveal-scale') || target.classList.contains('reveal-stagger')) {
                    target.classList.add('revealed');
                }
                // Trigger fade-in animation
                target.classList.remove('page-fade-in');
                void target.offsetWidth; // force reflow
                target.classList.add('page-fade-in');
                window.scrollTo(0, 0);
                if (history.pushState) history.pushState(null, '', '#' + id);
                else window.location.hash = id;
                updateHeaderScrollState();
                // Page-specific refresh hooks
                if (id === 'gallery' && typeof renderGallery === 'function') renderGallery();
                if (id === 'playoff' && typeof renderPlayoffBracket === 'function') renderPlayoffBracket();
                if (id === 'faq' && typeof initFAQ === 'function') initFAQ();
                if (id === 'home') {
                    if (typeof renderLatestResultsWidget === 'function') renderLatestResultsWidget();
                    if (typeof renderCountdownTimer === 'function') renderCountdownTimer();
                }
            }
            syncNavQuickSelect(id);
        }

        var lastHeaderScrollY = 0;
        var headerScrollTicking = false;
        var headerScrollEnterThreshold = 110;
        var headerScrollExitThreshold = 24;

        function setHeaderScrolledState(shouldScroll) {
            const siteHeader = document.querySelector('header');
            if (!siteHeader) return;
            var changed = siteHeader.classList.contains('scrolled') !== shouldScroll;
            siteHeader.classList.toggle('scrolled', shouldScroll);
            if (changed) {
                toggleLoginDropdown(false);
                setNavQuickSelectOpen(false);
            }
        }

        function updateHeaderScrollState() {
            if (headerScrollTicking) return;
            headerScrollTicking = true;

            window.requestAnimationFrame(function() {
                const currentY = Math.max(window.scrollY || 0, 0);
                const siteHeader = document.querySelector('header');
                if (!siteHeader) {
                    headerScrollTicking = false;
                    lastHeaderScrollY = currentY;
                    return;
                }
                const isScrolled = siteHeader.classList.contains('scrolled');
                if (!isScrolled && currentY >= headerScrollEnterThreshold) {
                    setHeaderScrolledState(true);
                } else if (isScrolled && currentY <= headerScrollExitThreshold) {
                    setHeaderScrolledState(false);
                }

                lastHeaderScrollY = currentY;
                headerScrollTicking = false;
            });
        }

        function buildSeasonStatsAdminPanelMarkup() {
            return '' +
                '<div id="seasonStatsAdminPanel" class="admin-only" data-no-admin-edit="true" contenteditable="false" style="display:none; margin-top:24px;">' +
                    '<div class="registration-form" style="max-width:820px;">' +
                        '<h3 style="color:#ff6f00; margin-bottom:12px; text-align:center;">Season Archive Tools</h3>' +
                        '<div class="registration-grid">' +
                            '<div>' +
                                '<label for="currentSeasonLabelInput">Current Season Label</label>' +
                                '<input id="currentSeasonLabelInput" type="text" placeholder="2026 Season">' +
                            '</div>' +
                        '</div>' +
                        '<div style="margin-top:12px; text-align:center;">' +
                            '<button type="button" class="cta-button small" onclick="saveCurrentSeasonLabel()">Save Season Label</button>' +
                            '<button type="button" class="cta-button small" style="margin-left:8px;" onclick="archiveCurrentSeasonToRecap()">Archive Current Season To Recap</button>' +
                        '</div>' +
                        '<p id="seasonStatsAdminMsg" style="text-align:center; margin-top:10px;"></p>' +
                    '</div>' +
                '</div>';
        }

        function buildSeasonRecapSectionMarkup() {
            return '' +
                '<section class="schedule" id="season-recap" data-no-admin-edit="true" contenteditable="false">' +
                    '<div class="container">' +
                        '<h2>Season Recap</h2>' +
                        '<p id="seasonRecapLabelDisplay" style="text-align:center; margin-bottom:16px; color:#ffb366; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;"></p>' +
                        '<p id="seasonRecapSortHint" style="text-align:center; margin:-4px auto 18px; color:#bbb; max-width:720px;">Click any stat column header to sort, or use the <strong style=\"color:#ff9800;\" aria-hidden=\"true\">↓</strong> / <strong style=\"color:#ff9800;\" aria-hidden=\"true\">↑</strong> <span class=\"sr-only\">high-to-low / low-to-high</span> buttons below each column to sort. Click an active button again to clear the sort.</p>' +
                        '<div class="registration-form" style="max-width:720px; margin-bottom:20px;">' +
                            '<label for="seasonRecapSelect">Choose Archived Season</label>' +
                            '<select id="seasonRecapSelect"></select>' +
                            '<p id="seasonRecapUpdatedNote" style="text-align:center; margin-top:10px; color:#bbb;"></p>' +
                        '</div>' +
                        '<h3 style="color:#ff6f00; margin-top:1.5rem; margin-bottom:0.5rem; text-align:center;">Offensive Season Recap</h3>' +
                        '<table class="schedule-table" id="recapOffensiveStatsTable">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th>Team</th>' +
                                    '<th>Player Name</th>' +
                                    '<th>Player Position<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                    '<th>Passing TD<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                    '<th>Passing Yards<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                    '<th>INT\'s<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                    '<th>Rushing Yards<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                    '<th>Rushing Touchdowns<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                    '<th>Recieving Yards<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                    '<th>Recieving Touchdowns<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                    '<th>Receptions<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody id="recapOffensiveStatsBody">' +
                                '<tr><td colspan="11" style="text-align:center; color:#aaa;">No archived offensive stats yet.</td></tr>' +
                            '</tbody>' +
                        '</table>' +
                        '<h3 style="color:#ff6f00; margin-top:2rem; margin-bottom:0.5rem; text-align:center;">Defensive Season Recap</h3>' +
                        '<table class="schedule-table" id="recapDefensiveStatsTable">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th>Team</th>' +
                                    '<th>Player Name</th>' +
                                    '<th>Player Position<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                    '<th>Tackles<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                    '<th>Sacks<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                    '<th>Interceptions<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                    '<th>Pass Break Ups<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                    '<th>Defensive TDs<span class="stat-sort-indicator" aria-hidden="true"></span></th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody id="recapDefensiveStatsBody">' +
                                '<tr><td colspan="7" style="text-align:center; color:#aaa;">No archived defensive stats yet.</td></tr>' +
                            '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</section>';
        }

        function ensureSeasonStatsAndRecapUI() {
            var navLinks = document.querySelector('header .nav-links');
            var statsLink = navLinks ? navLinks.querySelector('a[href="#player-stats"]') : null;
            if (statsLink) statsLink.textContent = 'Season Stats';

            if (navLinks && !navLinks.querySelector('a[href="#season-recap"]')) {
                var recapNavItem = document.createElement('li');
                recapNavItem.innerHTML = '<a href="#season-recap">Season Recap</a>';
                var paymentsItem = navLinks.querySelector('a[href="#payments"]');
                if (paymentsItem && paymentsItem.parentElement) navLinks.insertBefore(recapNavItem, paymentsItem.parentElement);
                else navLinks.appendChild(recapNavItem);
            }

            var statsSection = document.getElementById('player-stats');
            if (statsSection) {
                var statsContainer = statsSection.querySelector('.container');
                var statsHeading = statsContainer ? statsContainer.querySelector('h2') : null;
                if (statsHeading) statsHeading.textContent = 'Season Stats';
                if (statsHeading && !document.getElementById('currentSeasonLabelDisplay')) {
                    statsHeading.insertAdjacentHTML('afterend', '<p id="currentSeasonLabelDisplay" style="text-align:center; margin-bottom:16px; color:#ffb366; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;"></p>');
                }
                if (statsHeading && !document.getElementById('statsSortHint')) {
                    var seasonLabelDisplay = document.getElementById('currentSeasonLabelDisplay');
                    if (seasonLabelDisplay) seasonLabelDisplay.insertAdjacentHTML('afterend', '<p id="statsSortHint" style="text-align:center; margin:-4px auto 18px; color:#bbb; max-width:720px;">Click any stat column header to sort, or use the <strong style=\"color:#ff9800;\" aria-hidden=\"true\">↓</strong> / <strong style=\"color:#ff9800;\" aria-hidden=\"true\">↑</strong> <span class=\"sr-only\">high-to-low / low-to-high</span> buttons below each column to sort. Click an active button again to clear the sort.</p>');
                }
                var offensiveTableHead = document.querySelector('#offensiveStatsTable thead tr');
                if (offensiveTableHead) {
                    offensiveTableHead.innerHTML = '<th>Team</th><th>Player Name</th><th>Player Position<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Passing TD<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Passing Yards<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>INT\'s<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Rushing Yards<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Rushing Touchdowns<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Recieving Yards<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Recieving Touchdowns<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Receptions<span class="stat-sort-indicator" aria-hidden="true"></span></th>';
                }
                var defensiveTableHead = document.querySelector('#defensiveStatsTable thead tr');
                if (defensiveTableHead) {
                    defensiveTableHead.innerHTML = '<th>Team</th><th>Player Name</th><th>Player Position<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Tackles<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Sacks<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Interceptions<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Pass Break Ups<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Defensive TDs<span class="stat-sort-indicator" aria-hidden="true"></span></th>';
                }
                if (statsContainer && !document.getElementById('seasonStatsAdminPanel')) {
                    statsContainer.insertAdjacentHTML('beforeend', buildSeasonStatsAdminPanelMarkup());
                }
            }

            if (!document.getElementById('season-recap') && statsSection) {
                statsSection.insertAdjacentHTML('afterend', buildSeasonRecapSectionMarkup());
            }

            var recapTableHead = document.querySelector('#recapOffensiveStatsTable thead tr');
            if (recapTableHead) {
                recapTableHead.innerHTML = '<th>Team</th><th>Player Name</th><th>Player Position<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Passing TD<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Passing Yards<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>INT\'s<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Rushing Yards<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Rushing Touchdowns<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Recieving Yards<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Recieving Touchdowns<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Receptions<span class="stat-sort-indicator" aria-hidden="true"></span></th>';
            }
            var recapLabelDisplay = document.getElementById('seasonRecapLabelDisplay');
            if (recapLabelDisplay && !document.getElementById('seasonRecapSortHint')) {
                recapLabelDisplay.insertAdjacentHTML('afterend', '<p id="seasonRecapSortHint" style="text-align:center; margin:-4px auto 18px; color:#bbb; max-width:720px;">Click any stat column header to sort, or use the <strong style=\"color:#ff9800;\" aria-hidden=\"true\">↓</strong> / <strong style=\"color:#ff9800;\" aria-hidden=\"true\">↑</strong> <span class=\"sr-only\">high-to-low / low-to-high</span> buttons below each column to sort. Click an active button again to clear the sort.</p>');
            }
            var recapDefensiveTableHead = document.querySelector('#recapDefensiveStatsTable thead tr');
            if (recapDefensiveTableHead) {
                recapDefensiveTableHead.innerHTML = '<th>Team</th><th>Player Name</th><th>Player Position<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Tackles<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Sacks<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Interceptions<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Pass Break Ups<span class="stat-sort-indicator" aria-hidden="true"></span></th><th>Defensive TDs<span class="stat-sort-indicator" aria-hidden="true"></span></th>';
            }

            var recapEmptyState = document.querySelector('#recapOffensiveStatsBody tr td[colspan]');
            if (recapEmptyState && /No archived offensive stats yet\./i.test(recapEmptyState.textContent || '')) {
                recapEmptyState.setAttribute('colspan', '11');
            }
        }

        function ensureLeagueScheduleResultsUI() {
            var publicScheduleHeader = document.querySelector('#leagueScheduleTable thead tr th:last-child');
            if (publicScheduleHeader) publicScheduleHeader.textContent = 'Results';

            var adminScheduleHeader = document.querySelector('#leagueScheduleAdminPanel thead tr th:nth-child(6)');
            if (adminScheduleHeader) adminScheduleHeader.textContent = 'Results';

            var publicScheduleRows = document.querySelectorAll('#leagueScheduleBody tr');
            publicScheduleRows.forEach(function(row) {
                var cells = row.querySelectorAll('td');
                if (cells.length < 6) return;
                var resultCell = cells[5];
                if (resultCell.querySelector('.schedule-result-scoreboard') && resultCell.querySelector('.schedule-result-team')) return;

                var matchup = cells[3].querySelector('.schedule-matchup');
                var homeTeamName = matchup ? matchup.querySelector('.schedule-team-home .schedule-team-name') : null;
                var awayTeamName = matchup ? matchup.querySelector('.schedule-team-away .schedule-team-name') : null;
                var scoreText = (resultCell.textContent || '').trim() || '\u2014';
                var homeTeam = homeTeamName ? homeTeamName.textContent.trim() : 'TBD';
                var awayTeam = awayTeamName ? awayTeamName.textContent.trim() : 'TBD';
                var parsedResult = parseScheduleResultText(scoreText);

                resultCell.innerHTML = '<div class="schedule-result">' +
                    '<div class="schedule-result-scoreboard">' +
                        '<div class="schedule-result-score">' + escapeHtml(parsedResult.leftScore) + '</div>' +
                        '<div class="schedule-result-separator">-</div>' +
                        '<div class="schedule-result-score">' + escapeHtml(parsedResult.rightScore) + '</div>' +
                    '</div>' +
                    '<div class="schedule-result-teams">' +
                        '<div class="schedule-result-team">' + escapeHtml(homeTeam) + '</div>' +
                        '<div class="schedule-result-team">' + escapeHtml(awayTeam) + '</div>' +
                    '</div>' +
                '</div>';
            });
        }

        window.addEventListener('popstate', function() {
            var id = window.location.hash ? window.location.hash.substring(1) : 'home';
            if (ALL_PAGE_IDS.indexOf(id) !== -1 && canAccessPage(id)) {
                ALL_PAGE_IDS.forEach(function(pageId) {
                    var el = document.getElementById(pageId);
                    if (el) el.style.display = 'none';
                });
                var target = document.getElementById(id);
                if (target) {
                    target.style.display = 'block';
                    if (target.classList.contains('reveal') || target.classList.contains('reveal-scale') || target.classList.contains('reveal-stagger')) {
                        target.classList.add('revealed');
                    }
                    window.scrollTo(0, 0);
                }
                updateHeaderScrollState();
            } else {
                showPage('home');
            }
        });

        window.addEventListener('scroll', updateHeaderScrollState, { passive: true });

        function setSafeExternalHref(linkEl, url, allowedHosts) {
            if (!linkEl) return false;
            try {
                const parsed = new URL(url);
                const host = (parsed.hostname || '').toLowerCase();
                if (!/^https?:$/i.test(parsed.protocol)) return false;
                if (allowedHosts && allowedHosts.length && allowedHosts.indexOf(host) === -1) return false;
                linkEl.href = parsed.href;
                return true;
            } catch (err) {
                return false;
            }
        }

        function loadPaymentLinks() {
            try {
                const saved = JSON.parse(localStorage.getItem(PAYMENT_LINKS_KEY) || '{}');
                const normalizedLinks = {
                    team: (saved.team || DEFAULT_PAYPAL_URL).trim(),
                    freeAgent: (saved.freeAgent || DEFAULT_PAYPAL_URL).trim(),
                    cashApp: DEFAULT_CASHAPP_URL,
                    venmo: DEFAULT_VENMO_URL
                };
                PAYMENT_LINKS = {
                    team: normalizedLinks.team,
                    freeAgent: normalizedLinks.freeAgent,
                    cashApp: normalizedLinks.cashApp,
                    venmo: normalizedLinks.venmo
                };

                if (saved.team !== normalizedLinks.team || saved.freeAgent !== normalizedLinks.freeAgent ||
                        saved.cashApp !== normalizedLinks.cashApp || saved.venmo !== normalizedLinks.venmo) {
                    localStorage.setItem(PAYMENT_LINKS_KEY, JSON.stringify(normalizedLinks));
                }
            } catch (err) {
                PAYMENT_LINKS = {
                    team: DEFAULT_PAYPAL_URL,
                    freeAgent: DEFAULT_PAYPAL_URL,
                    cashApp: DEFAULT_CASHAPP_URL,
                    venmo: DEFAULT_VENMO_URL
                };
                localStorage.setItem(PAYMENT_LINKS_KEY, JSON.stringify(PAYMENT_LINKS));
            }
        }

        function renderPaymentMethodsInfo() {
            loadPaymentLinks();
            var panel = document.getElementById('paymentMethodsInfo');
            var list = document.getElementById('paymentMethodsList');
            if (!panel || !list) return;
            list.innerHTML = '';
            var hasItem = false;
            if (PAYMENT_LINKS.cashApp) {
                var caBadge = document.createElement('span');
                caBadge.textContent = '$ CashApp';
                caBadge.style.cssText = 'display:inline-flex;align-items:center;gap:8px;background:#1a3a1a;border:1px solid #00c244;border-radius:6px;padding:10px 18px;color:#00c244;font-weight:700;font-size:1rem;cursor:default;';
                list.appendChild(caBadge);
                hasItem = true;
            }
            if (PAYMENT_LINKS.venmo) {
                var vBadge = document.createElement('span');
                vBadge.textContent = '@ Venmo';
                vBadge.style.cssText = 'display:inline-flex;align-items:center;gap:8px;background:#1a1a3a;border:1px solid #3d95ce;border-radius:6px;padding:10px 18px;color:#3d95ce;font-weight:700;font-size:1rem;cursor:default;';
                list.appendChild(vBadge);
                hasItem = true;
            }
            panel.style.display = hasItem ? 'block' : 'none';
        }

        function loadPaymentNotificationSettings() {
            try {
                const saved = JSON.parse(localStorage.getItem(PAYMENT_NOTIFICATION_SETTINGS_KEY) || '{}');
                PAYMENT_NOTIFICATION_SETTINGS = {
                    adminEmail: DEFAULT_ADMIN_NOTIFICATION_EMAIL,
                    publicKey: saved.publicKey || '',
                    serviceId: saved.serviceId || 'service_sp3bqul',
                    templateId: saved.templateId || ''
                };
                if (saved.adminEmail !== DEFAULT_ADMIN_NOTIFICATION_EMAIL) {
                    localStorage.setItem(PAYMENT_NOTIFICATION_SETTINGS_KEY, JSON.stringify(PAYMENT_NOTIFICATION_SETTINGS));
                }
            } catch (err) {
                PAYMENT_NOTIFICATION_SETTINGS = {
                    adminEmail: DEFAULT_ADMIN_NOTIFICATION_EMAIL,
                    publicKey: '',
                    serviceId: 'service_sp3bqul',
                    templateId: ''
                };
                localStorage.setItem(PAYMENT_NOTIFICATION_SETTINGS_KEY, JSON.stringify(PAYMENT_NOTIFICATION_SETTINGS));
            }
        }

        function savePaymentLinks(links) {
            const teamLink = links && links.team ? links.team : DEFAULT_PAYPAL_URL;
            const freeAgentLink = links && links.freeAgent ? links.freeAgent : DEFAULT_PAYPAL_URL;
            PAYMENT_LINKS = {
                team: teamLink.trim(),
                freeAgent: freeAgentLink.trim(),
                cashApp: DEFAULT_CASHAPP_URL,
                venmo: DEFAULT_VENMO_URL
            };
            localStorage.setItem(PAYMENT_LINKS_KEY, JSON.stringify(PAYMENT_LINKS));
            queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.paymentLinks, PAYMENT_LINKS, 'PaymentLinks');
            renderPaymentMethodsInfo();
        }

        function savePaymentNotificationSettings(settings) {
            PAYMENT_NOTIFICATION_SETTINGS = {
                adminEmail: (settings.adminEmail || DEFAULT_ADMIN_NOTIFICATION_EMAIL).trim() || DEFAULT_ADMIN_NOTIFICATION_EMAIL,
                publicKey: (settings.publicKey || '').trim(),
                serviceId: (settings.serviceId || '').trim(),
                templateId: (settings.templateId || '').trim()
            };
            localStorage.setItem(PAYMENT_NOTIFICATION_SETTINGS_KEY, JSON.stringify(PAYMENT_NOTIFICATION_SETTINGS));
            queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.paymentNotificationSettings, PAYMENT_NOTIFICATION_SETTINGS, 'PaymentNotifications');
        }

        function normalizeSignupSeasonSettings(settings) {
            var openDate = settings && settings.openDate ? String(settings.openDate).trim() : '';
            var closeDate = settings && settings.closeDate ? String(settings.closeDate).trim() : '';
            if (openDate && isNaN(new Date(openDate).getTime())) openDate = '';
            if (closeDate && isNaN(new Date(closeDate).getTime())) closeDate = '';
            return {
                openDate: openDate,
                closeDate: closeDate
            };
        }

        function loadSignupSeasonSettings() {
            try {
                var normalized = normalizeSignupSeasonSettings(JSON.parse(localStorage.getItem(SIGNUP_SEASON_SETTINGS_KEY) || 'null'));
                localStorage.setItem(SIGNUP_SEASON_SETTINGS_KEY, JSON.stringify(normalized));
                return normalized;
            } catch (err) {
                var fallback = normalizeSignupSeasonSettings(null);
                localStorage.setItem(SIGNUP_SEASON_SETTINGS_KEY, JSON.stringify(fallback));
                return fallback;
            }
        }

        function getSignupSeasonStatus(settings, nowMs) {
            var normalized = normalizeSignupSeasonSettings(settings);
            var openMs = normalized.openDate ? new Date(normalized.openDate).getTime() : NaN;
            var closeMs = normalized.closeDate ? new Date(normalized.closeDate).getTime() : NaN;
            var currentMs = typeof nowMs === 'number' ? nowMs : Date.now();
            if (!normalized.openDate || !normalized.closeDate || isNaN(openMs) || isNaN(closeMs) || closeMs <= openMs) {
                return {
                    isOpen: false,
                    phase: 'closed',
                    message: 'Signups are closed until next season.'
                };
            }
            if (currentMs < openMs) {
                return {
                    isOpen: false,
                    phase: 'upcoming',
                    message: 'Signups open on ' + formatSignupSeasonDate(normalized.openDate) + '.'
                };
            }
            if (currentMs > closeMs) {
                return {
                    isOpen: false,
                    phase: 'closed',
                    message: 'Signups are closed until next season.'
                };
            }
            return {
                isOpen: true,
                phase: 'open',
                message: 'Signups are open until ' + formatSignupSeasonDate(normalized.closeDate) + '.'
            };
        }

        function formatSignupSeasonDate(value) {
            var parsed = new Date(value);
            if (isNaN(parsed.getTime())) return '';
            return parsed.toLocaleString();
        }

        function toLocalDatetimeInputValue(value) {
            var parsed = new Date(value);
            if (isNaN(parsed.getTime())) return '';
            return parsed.getFullYear() + '-' +
                String(parsed.getMonth() + 1).padStart(2, '0') + '-' +
                String(parsed.getDate()).padStart(2, '0') + 'T' +
                String(parsed.getHours()).padStart(2, '0') + ':' +
                String(parsed.getMinutes()).padStart(2, '0');
        }

        function renderSignupSeasonAvailability(settings) {
            var normalized = normalizeSignupSeasonSettings(settings || loadSignupSeasonSettings());
            var status = getSignupSeasonStatus(normalized);
            var notice = document.getElementById('signupStatusNotice');
            var form = document.getElementById('paymentForm');
            var msg = document.getElementById('paymentMsg');
            var submitBtn = document.getElementById('paySubmitBtn');
            if (notice) {
                notice.textContent = status.message;
                notice.className = 'signup-status-banner ' + (status.isOpen ? 'signup-status-open' : 'signup-status-closed');
            }
            if (form) {
                form.classList.toggle('signup-form-closed', !status.isOpen);
                Array.from(form.querySelectorAll('input, select, button, textarea')).forEach(function(field) {
                    field.disabled = !status.isOpen;
                });
            }
            if (submitBtn) {
                submitBtn.disabled = !status.isOpen;
                if (!status.isOpen) {
                    submitBtn.textContent = 'Signups Closed';
                }
            }
            if (msg) {
                if (status.isOpen) {
                    msg.style.color = '';
                    if (msg.textContent === 'Signups are closed until next season.' || /^Signups open on /i.test(msg.textContent || '')) {
                        msg.textContent = '';
                    }
                } else {
                    msg.style.color = '#ffb366';
                    msg.textContent = status.message;
                }
            }
            if (status.isOpen) {
                updatePaymentMethodLink();
            }
            return status;
        }

        function saveSignupSeasonSettings(settings) {
            var normalized = normalizeSignupSeasonSettings(settings);
            localStorage.setItem(SIGNUP_SEASON_SETTINGS_KEY, JSON.stringify(normalized));
            queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.signupSeason, normalized, 'SignupSeason');
            renderSignupSeasonAvailability(normalized);
        }

        function clearSignupSeasonSettings() {
            var cleared = normalizeSignupSeasonSettings(null);
            localStorage.setItem(SIGNUP_SEASON_SETTINGS_KEY, JSON.stringify(cleared));
            queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.signupSeason, null, 'SignupSeason');
            renderSignupSeasonAvailability(cleared);
        }

        function populateSignupSeasonEditor() {
            var settings = loadSignupSeasonSettings();
            var openInput = document.getElementById('signupOpenDateInput');
            var closeInput = document.getElementById('signupCloseDateInput');
            if (openInput) openInput.value = settings.openDate ? toLocalDatetimeInputValue(settings.openDate) : '';
            if (closeInput) closeInput.value = settings.closeDate ? toLocalDatetimeInputValue(settings.closeDate) : '';
        }

        function bindSignupSeasonAdminControls() {
            var saveBtn = document.getElementById('saveSignupSeasonSettings');
            var clearBtn = document.getElementById('clearSignupSeasonSettings');
            var msg = document.getElementById('signupSeasonAdminMsg');
            if (saveBtn && !saveBtn.dataset.bound) {
                saveBtn.dataset.bound = '1';
                saveBtn.addEventListener('click', function() {
                    if (!isAdminLoggedIn()) return;
                    var openInput = document.getElementById('signupOpenDateInput');
                    var closeInput = document.getElementById('signupCloseDateInput');
                    var openValue = openInput ? openInput.value : '';
                    var closeValue = closeInput ? closeInput.value : '';
                    if (!openValue || !closeValue) {
                        if (msg) {
                            msg.style.color = '#e65100';
                            msg.textContent = 'Select both a signup open date and close date.';
                        }
                        return;
                    }
                    var openMs = new Date(openValue).getTime();
                    var closeMs = new Date(closeValue).getTime();
                    if (isNaN(openMs) || isNaN(closeMs)) {
                        if (msg) {
                            msg.style.color = '#e65100';
                            msg.textContent = 'Enter valid signup dates.';
                        }
                        return;
                    }
                    if (closeMs <= openMs) {
                        if (msg) {
                            msg.style.color = '#e65100';
                            msg.textContent = 'The signup close date must be after the open date.';
                        }
                        return;
                    }
                    var openIso = new Date(openMs).toISOString();
                    var closeIso = new Date(closeMs).toISOString();
                    saveSignupSeasonSettings({
                        openDate: openIso,
                        closeDate: closeIso
                    });
                    if (msg) {
                        msg.style.color = '#4caf50';
                        msg.textContent = 'Signup season saved.';
                    }
                });
            }
            if (clearBtn && !clearBtn.dataset.bound) {
                clearBtn.dataset.bound = '1';
                clearBtn.addEventListener('click', function() {
                    if (!isAdminLoggedIn()) return;
                    clearSignupSeasonSettings();
                    var openInput = document.getElementById('signupOpenDateInput');
                    var closeInput = document.getElementById('signupCloseDateInput');
                    if (openInput) openInput.value = '';
                    if (closeInput) closeInput.value = '';
                    if (msg) {
                        msg.style.color = '#4caf50';
                        msg.textContent = 'Signup season cleared. Signups are now closed.';
                    }
                });
            }
        }

        async function fetchSignupSeasonSettingsFromSupabase() {
            if (isLocalPreviewMode()) return loadSignupSeasonSettings();
            var client = getSiteSupabaseClient();
            if (!client) return null;
            var config = getSiteSupabaseConfig();
            try {
                var response = await client
                    .from(config.stateTable)
                    .select('value')
                    .eq('key', SUPABASE_PUBLIC_STATE_KEYS.signupSeason)
                    .limit(1);
                if (response.error) {
                    logSupabaseOperation('SignupSeason', 'error', 'SELECT error while loading signup season settings.', response.error);
                    logSupabaseRlsHint('SignupSeason', response.error);
                    return null;
                }
                var row = Array.isArray(response.data) && response.data.length ? response.data[0] : null;
                var normalized = normalizeSignupSeasonSettings(row && row.value);
                localStorage.setItem(SIGNUP_SEASON_SETTINGS_KEY, JSON.stringify(normalized));
                return normalized;
            } catch (err) {
                logSupabaseOperation('SignupSeason', 'error', 'Unexpected SELECT failure while loading signup season settings.', err);
                logSupabaseRlsHint('SignupSeason', err);
                return null;
            }
        }

        async function enforceSignupSeasonForSubmission() {
            if (isLocalPreviewMode()) {
                var localStatus = getSignupSeasonStatus(loadSignupSeasonSettings());
                renderSignupSeasonAvailability();
                return {
                    allowed: localStatus.isOpen,
                    status: localStatus,
                    message: localStatus.message
                };
            }
            var remoteSettings = await fetchSignupSeasonSettingsFromSupabase();
            if (remoteSettings === null) {
                return {
                    allowed: false,
                    status: null,
                    message: 'We could not verify whether signups are open. Please try again later.'
                };
            }
            var status = renderSignupSeasonAvailability(remoteSettings);
            return {
                allowed: status.isOpen,
                status: status,
                message: status.message
            };
        }

        async function sendAdminPaymentNotification(details) {
            loadPaymentNotificationSettings();

            if (!PAYMENT_NOTIFICATION_SETTINGS.adminEmail ||
                !PAYMENT_NOTIFICATION_SETTINGS.publicKey ||
                !PAYMENT_NOTIFICATION_SETTINGS.serviceId ||
                !PAYMENT_NOTIFICATION_SETTINGS.templateId ||
                !window.emailjs) {
                return { sent: false, reason: 'not-configured' };
            }

            try {
                var typeLabel = REGISTRATION_TYPE_LABELS[details.type] || details.type || 'Unknown';
                await window.emailjs.send(
                    PAYMENT_NOTIFICATION_SETTINGS.serviceId,
                    PAYMENT_NOTIFICATION_SETTINGS.templateId,
                    {
                        to_email: PAYMENT_NOTIFICATION_SETTINGS.adminEmail,
                        admin_email: PAYMENT_NOTIFICATION_SETTINGS.adminEmail,
                        registration_type: typeLabel,
                        payer_name: details.name,
                        payer_email: details.email,
                        payer_phone: details.phone || 'N/A',
                        team_name: details.teamName || 'N/A',
                        team_member_count: details.teamMembers || 'N/A',
                        team_years: details.teamYears || 'N/A',
                        player_position: details.offPosition ? ('Off: ' + details.offPosition + ' | Def: ' + (details.defPosition || 'N/A')) : (details.position || 'N/A'),
                        football_experience: details.experience || 'N/A',
                        payment_method: details.method ? ({ paypal: 'PayPal', cashapp: 'CashApp', venmo: 'Venmo' }[details.method] || details.method) : 'N/A',
                        payment_username: details.paymentUsername || 'N/A',
                        paypal_link: details.paypalLink || 'Not configured',
                        submitted_at: details.submittedAt,
                        message: 'A new ' + typeLabel + ' signup was submitted.'
                    },
                    {
                        publicKey: PAYMENT_NOTIFICATION_SETTINGS.publicKey
                    }
                );
                return { sent: true };
            } catch (err) {
                return { sent: false, reason: 'send-failed', error: err };
            }
        }

        function bindPayPalSettingsControls() {
            const saveBtn = document.getElementById('savePayPalLinksBtn');
            const teamInput = document.getElementById('paypalTeamLink');
            const freeInput = document.getElementById('paypalFreeAgentLink');
            const cashAppInput = document.getElementById('cashAppLink');
            const venmoInput = document.getElementById('venmoLink');
            const adminEmailInput = document.getElementById('adminNotificationEmail');
            const publicKeyInput = document.getElementById('emailjsPublicKey');
            const serviceIdInput = document.getElementById('emailjsServiceId');
            const templateIdInput = document.getElementById('emailjsTemplateId');
            const msg = document.getElementById('paypalSettingsMsg');
            if (!saveBtn || !teamInput || !freeInput || !adminEmailInput || !publicKeyInput || !serviceIdInput || !templateIdInput || saveBtn.dataset.bound) return;
            saveBtn.dataset.bound = 'true';
            saveBtn.addEventListener('click', function() {
                if (!isAdminLoggedIn()) {
                    if (msg) {
                        msg.style.color = '#e65100';
                        msg.textContent = 'Admin login required to save payment settings.';
                    }
                    return;
                }
                savePaymentLinks({
                    team: teamInput.value,
                    freeAgent: freeInput.value
                });
                if (cashAppInput) cashAppInput.value = PAYMENT_LINKS.cashApp;
                if (venmoInput) venmoInput.value = PAYMENT_LINKS.venmo;
                savePaymentNotificationSettings({
                    adminEmail: DEFAULT_ADMIN_NOTIFICATION_EMAIL,
                    publicKey: publicKeyInput.value,
                    serviceId: serviceIdInput.value,
                    templateId: templateIdInput.value
                });
                if (msg) {
                    msg.style.color = 'green';
                    msg.textContent = 'Payment settings saved successfully.';
                }
                flushPersistSiteContent();
                if (updatePaymentMethodLink) { updatePaymentMethodLink(); }
            });
        }

        function renderPayPalSettings() {
            loadPaymentLinks();
            loadPaymentNotificationSettings();
            populateSignupSeasonEditor();
            const teamInput = document.getElementById('paypalTeamLink');
            const freeInput = document.getElementById('paypalFreeAgentLink');
            const cashAppInput = document.getElementById('cashAppLink');
            const venmoInput = document.getElementById('venmoLink');
            const adminEmailInput = document.getElementById('adminNotificationEmail');
            const publicKeyInput = document.getElementById('emailjsPublicKey');
            const serviceIdInput = document.getElementById('emailjsServiceId');
            const templateIdInput = document.getElementById('emailjsTemplateId');
            if (teamInput) teamInput.value = PAYMENT_LINKS.team || '';
            if (freeInput) freeInput.value = PAYMENT_LINKS.freeAgent || '';
            if (cashAppInput) cashAppInput.value = PAYMENT_LINKS.cashApp;
            if (venmoInput) venmoInput.value = PAYMENT_LINKS.venmo;
            if (cashAppInput) cashAppInput.readOnly = true;
            if (venmoInput) venmoInput.readOnly = true;
            if (adminEmailInput) adminEmailInput.value = DEFAULT_ADMIN_NOTIFICATION_EMAIL;
            if (publicKeyInput) publicKeyInput.value = PAYMENT_NOTIFICATION_SETTINGS.publicKey || '';
            if (serviceIdInput) serviceIdInput.value = PAYMENT_NOTIFICATION_SETTINGS.serviceId || '';
            if (templateIdInput) templateIdInput.value = PAYMENT_NOTIFICATION_SETTINGS.templateId || '';
        }

        const BRANDING_STORAGE_FOLDER = 'branding';
        const BRANDING_LOGO_FILENAME = 'site-logo.jpg';
        const BRANDING_HOME_BACKGROUND_FILENAME = 'home-hero-background.jpg';
        const BRAND_MARK_TEXT = '865 Elite';

        function normalizeBrandingImageUrl(value) {
            var normalized = String(value || '').trim();
            if (!normalized) return '';
            if (/^data:image\//i.test(normalized)) return normalized;
            if (/^https?:\/\//i.test(normalized)) return normalized;
            if (/^blob:/i.test(normalized)) return normalized;
            if (normalized.charAt(0) === '/') return normalized;
            if (/^\.\//.test(normalized)) return normalized;
            return '';
        }

        function setAdminSaveMessage(text, color, durationMs) {
            var msg = document.getElementById('saveMsg');
            if (!msg) return;
            if (setAdminSaveMessage._timer) {
                clearTimeout(setAdminSaveMessage._timer);
                setAdminSaveMessage._timer = null;
            }
            msg.style.color = color || '#fff';
            msg.textContent = text || '';
            if (text && durationMs) {
                setAdminSaveMessage._timer = setTimeout(function() {
                    if (msg.textContent === text) {
                        msg.textContent = '';
                        msg.style.color = '#fff';
                    }
                }, durationMs);
            }
        }

        function renderBrandMark(markEl, logoUrl) {
            if (!markEl) return;
            var safeLogoUrl = normalizeBrandingImageUrl(logoUrl);
            markEl.href = '#home';
            markEl.setAttribute('aria-label', 'Go to home page');
            markEl.classList.toggle('has-logo', !!safeLogoUrl);
            markEl.replaceChildren();
            if (safeLogoUrl) {
                // Cache-bust Supabase storage URLs to avoid stale images when admin re-uploads
                if (/^https?:\/\/[^/]*\.supabase\.co\//i.test(safeLogoUrl)) {
                    var separator = safeLogoUrl.indexOf('?') === -1 ? '?' : '&';
                    safeLogoUrl += separator + 'v=' + Date.now();
                }
                var img = document.createElement('img');
                img.src = safeLogoUrl;
                img.alt = '865 Elite Flag Football';
                img.decoding = 'async';
                markEl.appendChild(img);
                return;
            }
            markEl.textContent = BRAND_MARK_TEXT;
        }

        function applyHeroBackgroundToPage(backgroundUrl) {
            var hero = document.querySelector('.hero');
            if (!hero) return;
            var safeBackgroundUrl = normalizeBrandingImageUrl(backgroundUrl);
            var media = hero.querySelector(':scope > .hero-background-media');

            // Cache-bust Supabase storage URLs to avoid stale images
            if (safeBackgroundUrl && /^https?:\/\/[^/]*\.supabase\.co\//i.test(safeBackgroundUrl)) {
                var separator = safeBackgroundUrl.indexOf('?') === -1 ? '?' : '&';
                safeBackgroundUrl += separator + 'v=' + Date.now();
            }

            if (safeBackgroundUrl) {
                if (!media) {
                    media = document.createElement('img');
                    media.className = 'hero-background-media';
                    media.alt = '';
                    media.setAttribute('aria-hidden', 'true');
                    media.loading = 'eager';
                    media.fetchPriority = 'high';
                    media.decoding = 'async';
                    hero.insertBefore(media, hero.firstChild);
                }
                // Show shimmer placeholder while loading
                hero.classList.add('hero-background-loading');
                // Reset loaded state for new image
                media.classList.remove('loaded');
                // Fade in when image loads
                media.onload = function() {
                    media.classList.add('loaded');
                    hero.classList.remove('hero-background-loading');
                    hero.classList.add('has-background-image');
                };
                // Error handler: remove broken image and fall back to gradient
                media.onerror = function() {
                    media.classList.remove('loaded');
                    hero.classList.remove('hero-background-loading');
                    hero.classList.remove('has-background-image');
                    media.remove();
                };
                media.src = safeBackgroundUrl;
            } else {
                if (media) media.remove();
                hero.classList.remove('hero-background-loading');
                hero.classList.remove('has-background-image');
            }
        }

        function applyLogoToPage(logoUrl) {
            enforceHeaderLogoLayout();
            document.querySelectorAll('header nav .brand-mark, .hero-brand-mark, .footer-brand-mark').forEach(function(markEl) {
                renderBrandMark(markEl, logoUrl);
            });
        }

        async function clearLegacyLogoCaches() {
            var shouldRefreshCaches = false;
            try {
                shouldRefreshCaches = localStorage.getItem(LOGO_CACHE_VERSION_KEY) !== LOGO_CACHE_VERSION;
            } catch (err) {
                shouldRefreshCaches = true;
            }
            if (!shouldRefreshCaches) return;
            try {
                if ('serviceWorker' in navigator && typeof navigator.serviceWorker.getRegistrations === 'function') {
                    var registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map(function(registration) {
                        return Promise.resolve(registration.unregister()).catch(function(err) {
                            console.warn('Failed unregistering a service worker during logo refresh.', err);
                            return false;
                        });
                    }));
                }
            } catch (err) {
                console.warn('Failed clearing service worker registrations during logo refresh.', err);
            }
            try {
                if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
                    var cacheKeys = await caches.keys();
                    await Promise.all(cacheKeys.map(function(cacheKey) {
                        return Promise.resolve(caches.delete(cacheKey)).catch(function(err) {
                            console.warn('Failed deleting cache "' + cacheKey + '" during logo refresh.', err);
                            return false;
                        });
                    }));
                }
            } catch (err) {
                console.warn('Failed clearing Cache Storage during logo refresh.', err);
            }
            try { localStorage.setItem(LOGO_CACHE_VERSION_KEY, LOGO_CACHE_VERSION); } catch (err) {}
        }

        // Upload a branding image (given as a data URL) to Supabase Storage so that
        // only a small public URL needs to be saved in the state table.  This avoids
        // storing large base64 blobs in the database column, which can cause silent
        // upsert failures and lost branding on page refresh.
        async function uploadBrandingImageToSupabase(dataUrl, filename) {
            if (isLocalPreviewMode()) return null;
            var client = getSiteSupabaseClient();
            if (!client) return null;
            var config = getSiteSupabaseConfig();
            var bucket = config.galleryBucket || 'gallery-images';
            try {
                // Convert data URL → Blob
                var parts = dataUrl.split(',');
                var mimeMatch = parts[0].match(/:(.*?);/);
                var mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
                var binaryStr = atob(parts[1]);
                var bytes = new Uint8Array(binaryStr.length);
                for (var i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
                var blob = new Blob([bytes], { type: mime });

                var storagePath = BRANDING_STORAGE_FOLDER + '/' + filename;
                // upsert: true replaces the existing file at that path
                var uploadResp = await client.storage.from(bucket).upload(storagePath, blob, { upsert: true, contentType: mime });
                if (uploadResp.error) {
                    logSupabaseOperation('Branding', 'warn', 'Storage upload failed for "' + filename + '", falling back to data URL.', uploadResp.error);
                    return null;
                }
                var urlResp = client.storage.from(bucket).getPublicUrl(storagePath);
                var publicUrl = urlResp && urlResp.data && urlResp.data.publicUrl;
                if (!publicUrl) {
                    logSupabaseOperation('Branding', 'warn', 'Could not get public URL for "' + filename + '", falling back to data URL.');
                    return null;
                }
                // Strip any pre-existing query string before storing — the display functions
                // add a fresh cache-buster at render time, so we want the clean base URL in
                // the state table and IndexedDB so it stays valid forever.
                var baseUrl = publicUrl.split('?')[0];
                return baseUrl;
            } catch (err) {
                logSupabaseOperation('Branding', 'warn', 'Unexpected error uploading branding image, falling back to data URL.', err);
                return null;
            }
        }

        async function applySavedBranding() {
            try {
                var savedLogo = '';
                if (isSiteLogoOverrideEnabled()) {
                    savedLogo = await idbGet(SITE_LOGO_KEY);
                }
                applyLogoToPage(savedLogo ? String(savedLogo) : './assets/logo.png');
            } catch (err) {
                applyLogoToPage('./assets/logo.png');
            }
        }

        async function clearPersistedLegacyLogoState() {
            // Clear legacy logo keys from browser storage before hydration.
            // The active logo source is controlled by SUPABASE_PUBLIC_STATE_KEYS.siteLogo
            // plus SITE_LOGO_OVERRIDE_FLAG_KEY.
            try { localStorage.removeItem(SITE_LOGO_KEY); } catch (err) { console.warn('Failed clearing legacy logo from localStorage (SITE_LOGO_KEY).', err); }
            try { localStorage.removeItem(SUPABASE_PUBLIC_STATE_KEYS.siteLogo); } catch (err) { console.warn('Failed clearing legacy logo from localStorage (siteLogo state key).', err); }
            try { sessionStorage.removeItem(SITE_LOGO_KEY); } catch (err) {}
            try { sessionStorage.removeItem(SUPABASE_PUBLIC_STATE_KEYS.siteLogo); } catch (err) {}
        }

        async function applySavedHeroBackground() {
            // Restore saved background position
            try {
                var savedPos = localStorage.getItem('heroBgPosition_v1');
                if (savedPos) {
                    var hero = document.querySelector('.hero');
                    if (hero) hero.style.setProperty('--hero-bg-position', savedPos);
                }
            } catch (err) {}
            try {
                var savedBackground = await idbGet(HOME_HERO_BACKGROUND_KEY);
                applyHeroBackgroundToPage(savedBackground ? String(savedBackground) : './assets/background.png');
            } catch (err) {
                applyHeroBackgroundToPage('./assets/background.png');
            }
        }

        function readFileAsDataUrl(file) {
            return new Promise(function(resolve, reject) {
                var reader = new FileReader();
                reader.onload = function(event) { resolve(String((event.target && event.target.result) || '')); };
                reader.onerror = function() { reject(new Error('Unable to read image.')); };
                reader.readAsDataURL(file);
            });
        }

        function setBrandingControlsDisabled(disabled) {
            ['changeLogoBtn', 'changeHomeBackgroundBtn'].forEach(function(id) {
                var btn = document.getElementById(id);
                if (btn) btn.disabled = !!disabled;
            });
        }

        async function handleBrandingUpload(file, options) {
            if (!file) return;
            if (!/^image\//i.test(file.type || '')) {
                setAdminSaveMessage('Please select an image file.', '#ffb300', 3000);
                return;
            }
            setBrandingControlsDisabled(true);
            setAdminSaveMessage(options.pendingMessage || 'Uploading image...', '#fff');
            try {
                var sourceDataUrl = await readFileAsDataUrl(file);
                var compressedDataUrl = await compressImageDataUrl(sourceDataUrl, options.maxWidth, options.maxHeight, options.quality);
                var persistedValue = await uploadBrandingImageToSupabase(compressedDataUrl, options.filename) || compressedDataUrl;
                await idbSet(options.storageKey, persistedValue);
                if (options.storageKey === SITE_LOGO_KEY) {
                    try { localStorage.setItem(SITE_LOGO_OVERRIDE_FLAG_KEY, '1'); } catch (err) {}
                    await clearLegacyLogoCaches();
                }
                options.apply(persistedValue);
                var persistResults = await Promise.all(options.persistCalls(persistedValue));
                var sharedSaved = persistResults.every(function(result) { return !!result; });
                setAdminSaveMessage(
                    sharedSaved ? options.successMessage : options.successMessage + ' Saved locally; shared sync failed.',
                    sharedSaved ? '#4caf50' : '#ffb300',
                    sharedSaved ? 3000 : 5000
                );
                flushPersistSiteContent();
            } catch (err) {
                logSupabaseOperation('Branding', 'error', 'Branding upload failed.', err);
                setAdminSaveMessage(err && err.message ? err.message : 'Unable to save image. Please try again.', '#ff5252', 4000);
            } finally {
                setBrandingControlsDisabled(false);
            }
        }

        function applySavedCtaButton() {
            try {
                var saved = JSON.parse(localStorage.getItem(CTA_BUTTON_KEY) || '{}');
                var btn = document.getElementById('heroCtaBtn');
                if (btn) {
                    if (saved.text) btn.textContent = saved.text;
                    if (saved.link) btn.setAttribute('href', saved.link);
                }
            } catch (err) {
                // Ignore CTA button restore errors.
            }
        }

        function bindCtaButtonControls() {
            var saveBtn = document.getElementById('saveCtaBtnSettings');
            if (!saveBtn) return;
            saveBtn.onclick = function() {
                if (!isAdminLoggedIn()) return;
                var textInput = document.getElementById('ctaBtnTextInput');
                var linkInput = document.getElementById('ctaBtnLinkInput');
                var msgEl = document.getElementById('ctaBtnMsg');
                var newText = (textInput && textInput.value.trim()) || 'Join Our League';
                var newLink = (linkInput && linkInput.value.trim()) || '#payments';
                var btn = document.getElementById('heroCtaBtn');
                if (btn) {
                    btn.textContent = newText;
                    btn.setAttribute('href', newLink);
                }
                try {
                    var ctaState = { text: newText, link: newLink };
                    localStorage.setItem(CTA_BUTTON_KEY, JSON.stringify(ctaState));
                    queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.ctaButton, ctaState, 'CTA');
                } catch (err) {
                    // Ignore storage write failures.
                }
                if (msgEl) {
                    msgEl.style.color = '#4caf50';
                    msgEl.textContent = 'Button saved!';
                    setTimeout(function() { msgEl.textContent = ''; }, 2000);
                }
                flushPersistSiteContent();
            };
        }

        function populateCtaButtonEditor() {
            try {
                var saved = JSON.parse(localStorage.getItem(CTA_BUTTON_KEY) || '{}');
                var btn = document.getElementById('heroCtaBtn');
                var textInput = document.getElementById('ctaBtnTextInput');
                var linkInput = document.getElementById('ctaBtnLinkInput');
                if (textInput) textInput.value = saved.text || (btn ? btn.textContent.trim() : 'Join Our League');
                if (linkInput) linkInput.value = saved.link || (btn ? btn.getAttribute('href') : '#payments');
            } catch (err) {
                // Ignore editor populate errors.
            }
        }

        function bindAdminBrandingControls() {
            var logoBtn = document.getElementById('changeLogoBtn');
            var logoInput = document.getElementById('siteLogoUploadInput');
            var backgroundBtn = document.getElementById('changeHomeBackgroundBtn');
            var backgroundInput = document.getElementById('homeBackgroundUploadInput');

            if (logoBtn && logoInput && !logoBtn.dataset.bound) {
                logoBtn.dataset.bound = 'true';
                logoBtn.onclick = function() {
                    if (!isAdminLoggedIn()) {
                        setAdminSaveMessage('Admin login required to change the logo.', '#ffb300', 3000);
                        return;
                    }
                    logoInput.click();
                };
            }
            if (logoInput && !logoInput.dataset.bound) {
                logoInput.dataset.bound = 'true';
                logoInput.addEventListener('change', async function() {
                    var file = this.files && this.files[0];
                    await handleBrandingUpload(file, {
                        filename: BRANDING_LOGO_FILENAME,
                        storageKey: SITE_LOGO_KEY,
                        maxWidth: 600,
                        maxHeight: 600,
                        quality: 0.9,
                        pendingMessage: 'Saving logo...',
                        successMessage: 'Logo saved.',
                        apply: function(value) {
                            applyLogoToPage(value);
                        },
                        persistCalls: function(value) {
                            return [
                                queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.siteLogo, value, 'BrandingLogo'),
                                queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.siteLogoOverrideEnabled, true, 'BrandingLogo')
                            ];
                        }
                    });
                    this.value = '';
                });
            }

            if (backgroundBtn && backgroundInput && !backgroundBtn.dataset.bound) {
                backgroundBtn.dataset.bound = 'true';
                backgroundBtn.onclick = function() {
                    if (!isAdminLoggedIn()) {
                        setAdminSaveMessage('Admin login required to change the home background.', '#ffb300', 3000);
                        return;
                    }
                    backgroundInput.click();
                };
            }
            if (backgroundInput && !backgroundInput.dataset.bound) {
                backgroundInput.dataset.bound = 'true';
                backgroundInput.addEventListener('change', async function() {
                    var file = this.files && this.files[0];
                    await handleBrandingUpload(file, {
                        filename: BRANDING_HOME_BACKGROUND_FILENAME,
                        storageKey: HOME_HERO_BACKGROUND_KEY,
                        maxWidth: 3840,
                        maxHeight: 2160,
                        quality: 0.92,
                        pendingMessage: 'Saving home background...',
                        successMessage: 'Home background saved.',
                        apply: function(value) {
                            applyHeroBackgroundToPage(value);
                        },
                        persistCalls: function(value) {
                            return [
                                queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.homeHeroBackground, value, 'BrandingBackground')
                            ];
                        }
                    });
                    this.value = '';
                });
            }
        }

        function ensureAdminBrandingUI() {
            const adminHeader = document.getElementById('adminHeader');
            if (!adminHeader) return;

            if (!document.getElementById('saveChangesBtn')) {
                const btn = document.createElement('button');
                btn.id = 'saveChangesBtn';
                btn.className = 'cta-button small';
                btn.style.marginRight = '8px';
                btn.textContent = 'Save Changes';
                btn.onclick = saveAllChanges;
                adminHeader.appendChild(btn);
            }

            if (!document.getElementById('togglePageEditBtn')) {
                const btn = document.createElement('button');
                btn.id = 'togglePageEditBtn';
                btn.className = 'cta-button small';
                btn.style.marginRight = '8px';
                btn.textContent = 'Enable Editing';
                btn.onclick = togglePageEdit;
                adminHeader.appendChild(btn);
            }

            if (!document.getElementById('changeLogoBtn')) {
                const btn = document.createElement('button');
                btn.id = 'changeLogoBtn';
                btn.type = 'button';
                btn.className = 'cta-button small';
                btn.style.marginRight = '8px';
                btn.textContent = 'Change Logo';
                adminHeader.appendChild(btn);
            }

            if (!document.getElementById('changeHomeBackgroundBtn')) {
                const btn = document.createElement('button');
                btn.id = 'changeHomeBackgroundBtn';
                btn.type = 'button';
                btn.className = 'cta-button small';
                btn.style.marginRight = '8px';
                btn.textContent = 'Change Home Background';
                adminHeader.appendChild(btn);
            }

            if (!document.getElementById('siteLogoUploadInput')) {
                const input = document.createElement('input');
                input.id = 'siteLogoUploadInput';
                input.type = 'file';
                input.accept = 'image/*';
                input.hidden = true;
                adminHeader.appendChild(input);
            }

            if (!document.getElementById('homeBackgroundUploadInput')) {
                const input = document.createElement('input');
                input.id = 'homeBackgroundUploadInput';
                input.type = 'file';
                input.accept = 'image/*';
                input.hidden = true;
                adminHeader.appendChild(input);
            }

            if (!document.getElementById('bgPositionSelect')) {
                var select = document.createElement('select');
                select.id = 'bgPositionSelect';
                select.title = 'Background focal point';
                select.style.cssText = 'margin-right:8px;padding:6px 10px;font-size:0.85rem;border-radius:4px;border:1px solid #ff6f00;background:#16213e;color:#e0e0e0;cursor:pointer;';
                var positions = [
                    { value: 'center', label: 'Center' },
                    { value: 'center top', label: 'Top' },
                    { value: 'center bottom', label: 'Bottom' },
                    { value: 'left center', label: 'Left' },
                    { value: 'right center', label: 'Right' }
                ];
                positions.forEach(function(pos) {
                    var opt = document.createElement('option');
                    opt.value = pos.value;
                    opt.textContent = 'BG: ' + pos.label;
                    select.appendChild(opt);
                });
                // Restore saved position
                try {
                    var savedPos = localStorage.getItem('heroBgPosition_v1') || 'center';
                    select.value = savedPos;
                } catch (err) {}
                select.onchange = function() {
                    var hero = document.querySelector('.hero');
                    if (hero) hero.style.setProperty('--hero-bg-position', select.value);
                    try { localStorage.setItem('heroBgPosition_v1', select.value); } catch (err) {}
                    if (isAdminLoggedIn()) {
                        queueSharedPublicStatePersist('hero_bg_position', select.value, 'BgPosition');
                    }
                };
                adminHeader.appendChild(select);
            }

            const toggleBtn = document.getElementById('togglePageEditBtn');

        }

        function setAdminHeaderVisible(isVisible) {
            const adminHdr = document.getElementById('adminHeader');
            if (!adminHdr) return;
            adminHdr.style.display = isVisible ? 'flex' : 'none';
            adminHdr.classList.toggle('hidden', !isVisible);
            if (isVisible) {
                ['saveChangesBtn'].forEach(function(id) {
                    var el = document.getElementById(id);
                    if (el) el.style.display = 'inline-block';
                });
            }
        }

        function enforceNonEditableAdminUI() {
            document.querySelectorAll('[data-no-admin-edit="true"]').forEach(el => {
                el.setAttribute('contenteditable', 'false');
            });
            // Ensure all admin-area buttons are never contenteditable (prevents click interception)
            document.querySelectorAll('#adminOnly button, #adminHeader button, #leagueScheduleAdminPanel button, #galleryAdminPanel button, #playoffAdminPanel button').forEach(function(el) {
                el.removeAttribute('contenteditable');
            });
        }

        function ensureNavHamburger() {
            var nav = document.querySelector('header nav');
            if (!nav) return;
            var existing = document.getElementById('navHamburger');
            if (existing) existing.remove();
            var hamburger = document.createElement('button');
            hamburger.id = 'navHamburger';
            hamburger.className = 'nav-hamburger';
            hamburger.setAttribute('aria-label', 'Toggle navigation');
            hamburger.setAttribute('aria-expanded', 'false');
            hamburger.textContent = '\u2630'; // ☰
            nav.appendChild(hamburger);
            hamburger.addEventListener('click', function() {
                setNavQuickSelectOpen();
            });
            updateNavQuickSelectOptions();
            setNavQuickSelectOpen(false);
        }

        async function restoreSiteContent() {
            try {
                const saved = await idbGet(PAGE_CONTENT_KEY);
                const container = document.getElementById('siteContent');
                const savedVersion = getStoredPageContentVersion();
                if (saved && container && savedVersion === PAGE_CONTENT_TEMPLATE_VERSION) {
                    container.innerHTML = saved;
                } else if (saved && savedVersion !== PAGE_CONTENT_TEMPLATE_VERSION) {
                    await idbDelete(PAGE_CONTENT_KEY);
                }
            } catch (err) {
                // If storage is unavailable or corrupted, continue with default markup.
            }
            // Always run lockdown after restoring — cleans ALL admin artifacts
            lockdownForPublic();
        }

        function enforceHeaderLogoLayout() {
            var logoDivs = document.querySelectorAll('header nav .logo');
            var logoDiv = null;
            for (var i = 0; i < logoDivs.length; i++) {
                if (logoDivs[i].tagName === 'DIV') { logoDiv = logoDivs[i]; break; }
            }
            if (!logoDiv) return;
            var existingBrandMark = logoDiv.querySelector(':scope > a.brand-mark');
            if (existingBrandMark && logoDiv.children.length === 1) {
                existingBrandMark.href = '#home';
                existingBrandMark.setAttribute('aria-label', 'Go to home page');
                existingBrandMark.textContent = BRAND_MARK_TEXT;
                return;
            }
            logoDiv.replaceChildren();
            var brandMark = document.createElement('a');
            brandMark.href = '#home';
            brandMark.className = 'brand-mark';
            brandMark.setAttribute('aria-label', 'Go to home page');
            brandMark.textContent = BRAND_MARK_TEXT;
            logoDiv.appendChild(brandMark);
        }

        /* ── Public Lockdown ──────────────────────────────────────
           Strips every editable/admin artifact from the page.
           Called on every page load BEFORE any admin check runs,
           so a non-admin visitor can never see editing controls. */
        function lockdownForPublic() {
            // 1. Remove ALL contenteditable attributes everywhere
            document.querySelectorAll('[contenteditable]').forEach(function(el) {
                el.removeAttribute('contenteditable');
            });

            // 2. Remove admin-editable class from body
            document.body.classList.remove('admin-editable');

            // 3. Hide admin header & all its buttons
            var adminHdr = document.getElementById('adminHeader');
            if (adminHdr) { adminHdr.style.display = 'none'; adminHdr.classList.add('hidden'); }
            var navPanel = document.getElementById('navQuickSelectPanel');
            if (navPanel) {
                navPanel.classList.add('hidden');
                navPanel.style.display = 'none';
                navPanel.setAttribute('aria-hidden', 'true');
            }
            var footerAdminForm = document.getElementById('footerAdminLoginForm');
            if (footerAdminForm) footerAdminForm.style.display = 'grid';
            var footerAdminSession = document.getElementById('footerAdminSession');
            if (footerAdminSession) {
                footerAdminSession.style.display = 'none';
                footerAdminSession.classList.add('hidden');
            }
            var footerAdminMsg = document.getElementById('footerAdminLoginMsg');
            if (footerAdminMsg) footerAdminMsg.textContent = '';

            // 4. Hide admin-only navigation links
            document.querySelectorAll('.admin-nav-item').forEach(function(el) { el.classList.remove('visible'); });

            // 4b. Remove 'visible' from all admin-only sections (covers gallery, playoff, etc.)
            document.querySelectorAll('.admin-only').forEach(function(el) { el.classList.remove('visible'); el.style.display = ''; });

            // 5. Hide admin-only sections container
            var adminOnly = document.getElementById('adminOnly');
            if (adminOnly) adminOnly.classList.remove('visible');
            var scheduleAdminPanel = document.getElementById('leagueScheduleAdminPanel');
            if (scheduleAdminPanel) scheduleAdminPanel.classList.remove('visible');

            // 6. Hide stats admin buttons (Add Player)
            var offBtn = document.getElementById('offensiveStatsAdminBtns');
            if (offBtn) offBtn.style.display = 'none';
            var defBtn = document.getElementById('defensiveStatsAdminBtns');
            if (defBtn) defBtn.style.display = 'none';

            // 7. Remove admin-only "Remove" column headers from stats tables
            document.querySelectorAll('.admin-remove-th').forEach(function(el) { el.remove(); });

            // 8. Re-apply explicit non-editable on protected sections
            ['standings','leagueSchedule','player-stats','season-recap','adminHeader','memberHeader','paypalSettings','leagueScheduleAdminPanel','seasonStatsAdminPanel'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) { el.setAttribute('contenteditable','false'); el.setAttribute('data-no-admin-edit','true'); }
            });

            // 9. Disable and hide admin-only form controls in case a saved state leaked them into view
            document.querySelectorAll('#adminOnly input, #adminOnly select, #adminOnly textarea, #adminOnly button').forEach(function(el) {
                el.disabled = true;
            });
            document.querySelectorAll('#leagueScheduleAdminPanel input, #leagueScheduleAdminPanel select, #leagueScheduleAdminPanel textarea, #leagueScheduleAdminPanel button').forEach(function(el) {
                el.disabled = true;
            });
            document.querySelectorAll('#adminOnly .team-logo-input').forEach(function(el) {
                el.style.display = 'none';
            });
        }

        function persistSiteContent() {
            try {
                if (!isAdminLoggedIn()) return;
                const container = document.getElementById('siteContent');
                if (!container) return;
                // Clone and strip ALL admin artifacts before saving
                const clone = container.cloneNode(true);
                // Remove contenteditable attributes
                clone.querySelectorAll('[contenteditable]').forEach(function(el) { el.removeAttribute('contenteditable'); });
                // Clear dynamically-rendered admin content so non-admin visitors won't see inputs
                var offClone = clone.querySelector('#offensiveStatsBody');
                if (offClone) offClone.innerHTML = '';
                var defClone = clone.querySelector('#defensiveStatsBody');
                if (defClone) defClone.innerHTML = '';
                var recapOffClone = clone.querySelector('#recapOffensiveStatsBody');
                if (recapOffClone) recapOffClone.innerHTML = '';
                var recapDefClone = clone.querySelector('#recapDefensiveStatsBody');
                if (recapDefClone) recapDefClone.innerHTML = '';
                // Force admin header hidden in saved state
                var ahClone = clone.querySelector('#adminHeader');
                if (ahClone) { ahClone.style.display = 'none'; ahClone.classList.add('hidden'); }
                var navPanelClone = clone.querySelector('#navQuickSelectPanel');
                if (navPanelClone) {
                    navPanelClone.style.display = 'none';
                    navPanelClone.classList.add('hidden');
                    navPanelClone.setAttribute('aria-hidden', 'true');
                }
                var footerFormClone = clone.querySelector('#footerAdminLoginForm');
                if (footerFormClone) footerFormClone.style.display = 'grid';
                var footerSessionClone = clone.querySelector('#footerAdminSession');
                if (footerSessionClone) {
                    footerSessionClone.style.display = 'none';
                    footerSessionClone.classList.add('hidden');
                }
                var footerMsgClone = clone.querySelector('#footerAdminLoginMsg');
                if (footerMsgClone) footerMsgClone.textContent = '';
                // Force admin-only sections hidden in saved state
                var aoClone = clone.querySelector('#adminOnly');
                if (aoClone) aoClone.classList.remove('visible');
                var schedulePanelClone = clone.querySelector('#leagueScheduleAdminPanel');
                if (schedulePanelClone) schedulePanelClone.classList.remove('visible');
                // Force admin nav items hidden
                clone.querySelectorAll('.admin-nav-item').forEach(function(el) { el.classList.remove('visible'); });
                // Hide stats admin buttons
                var offBtnC = clone.querySelector('#offensiveStatsAdminBtns');
                if (offBtnC) offBtnC.style.display = 'none';
                var defBtnC = clone.querySelector('#defensiveStatsAdminBtns');
                if (defBtnC) defBtnC.style.display = 'none';
                var seasonPanelClone = clone.querySelector('#seasonStatsAdminPanel');
                if (seasonPanelClone) seasonPanelClone.style.display = 'none';
                // Remove admin-only column headers from stats
                clone.querySelectorAll('.admin-remove-th').forEach(function(el) { el.remove(); });
                // Remove dynamically-created hamburger so it is always re-created by JS with fresh listeners
                var hamburgerClone = clone.querySelector('#navHamburger');
                if (hamburgerClone) hamburgerClone.remove();
                // Clean gallery / playoff admin panels before saving
                var galPanelClone = clone.querySelector('#galleryAdminPanel');
                if (galPanelClone) galPanelClone.classList.remove('visible');
                var playoffPanelClone = clone.querySelector('#playoffAdminPanel');
                if (playoffPanelClone) playoffPanelClone.classList.remove('visible');
                // Reset dynamic payment methods panel — re-rendered on load
                var pmInfoClone = clone.querySelector('#paymentMethodsInfo');
                if (pmInfoClone) { pmInfoClone.style.display = 'none'; pmInfoClone.querySelector('#paymentMethodsList') && (pmInfoClone.querySelector('#paymentMethodsList').innerHTML = ''); }
                idbSet(PAGE_CONTENT_KEY, clone.innerHTML);
                localStorage.setItem(PAGE_CONTENT_VERSION_KEY, PAGE_CONTENT_TEMPLATE_VERSION);
                queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.pageContent, clone.innerHTML, 'PageContent');
                queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.pageContentVersion, PAGE_CONTENT_TEMPLATE_VERSION, 'PageContent');
            } catch (err) {
                // Ignore storage write failures.
            }
        }

        (async function() {
            await clearLegacyLogoCaches();
            await migrateLocalStorageToIDB();
            await clearPersistedLegacyLogoState();
            await hydrateSharedPublicStateFromSupabase();
            await restoreSiteContent();
            enforceHeaderLogoLayout();
            ensureSeasonStatsAndRecapUI();
            ensureLeagueScheduleResultsUI();
            ensurePaymentSignupUI();
            loadPaymentLinks();
            renderPaymentMethodsInfo();
            renderSignupSeasonAvailability();
            await applySavedBranding();
            await applySavedHeroBackground();
            applySavedCtaButton();
            ensureAdminBrandingUI();
            enforceNonEditableAdminUI();
            startSharedPublicStateRefreshLoop();
            ensureNavHamburger();
            bindAdminBrandingControls();
            bindPayPalSettingsControls();
            bindSignupSeasonAdminControls();
            bindCtaButtonControls();
            renderPayPalSettings();
            try {
                await syncPaymentRequestsFromSupabase();
            } catch (err) {
                logPaymentSignupEvent('error', 'Initial signup sync from Supabase failed.', err);
            }

            // Show the correct page immediately after restoring content
            (function() {
                var h = window.location.hash ? window.location.hash.substring(1) : 'home';
                var restricted = ['myProfile','guestArea','documentsAdmin'];
                var validPage = ALL_PAGE_IDS.indexOf(h) !== -1 && restricted.indexOf(h) === -1 ? h : 'home';
                showPage(validPage);
                updateHeaderScrollState();
            })();
        })();

        // logo/image support removed — header shows text only.

        // --- Members persistence (localStorage) ---
        function normalizeMemberStatus(status) {
            const normalized = String(status || '').toLowerCase();
            const validStatuses = ['pending', 'denied', 'approved'];
            if (validStatuses.includes(normalized)) return normalized;
            return 'pending';
        }
        function loadMembers() {
            try {
                if (Array.isArray(membersState)) {
                    return membersState.map(function(member) {
                        return Object.assign({}, member, {
                            status: normalizeMemberStatus(member && member.status)
                        });
                    });
                }
                if (isLocalPreviewMode()) {
                    const parsed = JSON.parse(localStorage.getItem('members') || '[]');
                    if (!Array.isArray(parsed)) return [];
                    membersState = parsed;
                    return parsed.map(function(member) {
                        return Object.assign({}, member, {
                            status: normalizeMemberStatus(member && member.status)
                        });
                    });
                }
                return [];
            } catch (err) {
                return [];
            }
        }
        function saveMembers(list) {
            const normalized = (Array.isArray(list) ? list : []).map(function(member) {
                return Object.assign({}, member, {
                    status: normalizeMemberStatus(member && member.status)
                });
            });
            membersState = normalized;
            if (isLocalPreviewMode()) safeLocalStorageSet('members', JSON.stringify(normalized));
            renderUsersTableForAdmin();
            renderAdminSignupNotifications();
            queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.members, normalized, 'Members');
            return normalized;
        }

        function ensurePaymentSignupUI() {
            var coachingWrap = document.getElementById('teamCoachingStaffWrap');
            if (coachingWrap) coachingWrap.remove();

            var staleCoachingLabel = Array.from(document.querySelectorAll('#paymentForm label')).find(function(label) {
                return /number of coaching staff/i.test(label.textContent || '');
            });
            if (staleCoachingLabel && staleCoachingLabel.parentElement) {
                staleCoachingLabel.parentElement.remove();
            }

            // Remove any stale single position field from old versions (e.g. "Position Played", "What Position Do You Play?")
            Array.from(document.querySelectorAll('#paymentForm label')).forEach(function(label) {
                var text = label.textContent || '';
                if (/position.?played|what position/i.test(text) && label.parentElement) {
                    label.parentElement.remove();
                }
            });

            // Ensure the positions row wrapper exists with both dropdowns side by side
            var regGrid = document.querySelector('#paymentForm .registration-grid');
            if (regGrid) {
                var posRow = document.getElementById('freeAgentPositionsRow');
                var offPosWrap = document.getElementById('freeAgentOffPosWrap');
                var defPosWrap = document.getElementById('freeAgentDefPosWrap');

                // If posRow is missing, create it
                if (!posRow) {
                    posRow = document.createElement('div');
                    posRow.id = 'freeAgentPositionsRow';
                    posRow.style.cssText = 'display: none; grid-column: 1 / -1;';
                    var innerGrid = document.createElement('div');
                    innerGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px;';
                    posRow.appendChild(innerGrid);
                    var expWrap = document.getElementById('freeAgentExperienceWrap');
                    if (expWrap && expWrap.parentElement === regGrid) {
                        regGrid.insertBefore(posRow, expWrap);
                    } else {
                        regGrid.appendChild(posRow);
                    }
                }

                var innerGrid = posRow.querySelector('div');
                if (!innerGrid) {
                    innerGrid = document.createElement('div');
                    innerGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px;';
                    posRow.appendChild(innerGrid);
                }

                // Move/create offensive position wrap inside posRow inner grid
                if (!offPosWrap) {
                    offPosWrap = document.createElement('div');
                    offPosWrap.id = 'freeAgentOffPosWrap';
                    offPosWrap.innerHTML =
                        '<label for="payOffPosition">Offensive Position</label>' +
                        '<select id="payOffPosition">' +
                            '<option value="">Select offensive position</option>' +
                            '<option value="QB">QB</option>' +
                            '<option value="RB">RB</option>' +
                            '<option value="WR">WR</option>' +
                            '<option value="TE">TE</option>' +
                            '<option value="C">C</option>' +
                            '<option value="OL">OL</option>' +
                            '<option value="ATH">ATH (Athlete)</option>' +
                        '</select>';
                    innerGrid.insertBefore(offPosWrap, innerGrid.firstChild);
                } else if (offPosWrap.parentElement !== innerGrid) {
                    // It exists but outside the posRow — move it inside
                    offPosWrap.style.display = '';
                    innerGrid.insertBefore(offPosWrap, innerGrid.firstChild);
                }

                // Move/create defensive position wrap inside posRow inner grid
                if (!defPosWrap) {
                    defPosWrap = document.createElement('div');
                    defPosWrap.id = 'freeAgentDefPosWrap';
                    defPosWrap.innerHTML =
                        '<label for="payDefPosition">Defensive Position</label>' +
                        '<select id="payDefPosition">' +
                            '<option value="">Select defensive position</option>' +
                            '<option value="DL">DL</option>' +
                            '<option value="LB">LB</option>' +
                            '<option value="CB">CB</option>' +
                            '<option value="S">S</option>' +
                            '<option value="DB">DB</option>' +
                            '<option value="Rusher">Rusher</option>' +
                        '</select>';
                    innerGrid.appendChild(defPosWrap);
                } else if (defPosWrap.parentElement !== innerGrid) {
                    defPosWrap.style.display = '';
                    innerGrid.appendChild(defPosWrap);
                }
            }

            var teamMembersInput = document.getElementById('payTeamMembers');
            if (teamMembersInput && teamMembersInput.tagName === 'SELECT') {
                Array.from(teamMembersInput.options).forEach(function(option) {
                    var value = Number(option.value || '0');
                    if (value > 16) option.remove();
                });
                if (Number(teamMembersInput.value || '0') > 16) {
                    teamMembersInput.value = '16';
                }
            }
        }

        function logPaymentSignupEvent(type, details, extra) {
            if (type === 'error') {
                console.error('[Signup][Payments] ' + details, extra || '');
                return;
            }
            if (type === 'warn') {
                console.warn('[Signup][Payments] ' + details, extra || '');
                return;
            }
            console.log('[Signup][Payments] ' + details, extra || '');
        }

        function logPaymentSupabaseError(type, message, error) {
            console.error('[Signup][Supabase][' + type + '] ' + message);
            if (error) {
                console.error('[Signup][Supabase][' + type + '] Full error object:', JSON.stringify(error, null, 2));
                console.error('[Signup][Supabase][' + type + '] error.message:', error.message);
                console.error('[Signup][Supabase][' + type + '] error.details:', error.details);
                console.error('[Signup][Supabase][' + type + '] error.hint:', error.hint);
                console.error('[Signup][Supabase][' + type + '] error.code:', error.code);
            }
            var details = String((error && (error.message || error.details || error.hint)) || '').toLowerCase();
            if (details.indexOf('row-level security') !== -1 || details.indexOf('rls') !== -1 || details.indexOf('permission denied') !== -1) {
                console.error('[Signup][Supabase][RLS] Check RLS SELECT/INSERT/UPDATE policies for registrations table.', error || '');
            }
        }

        function normalizePaymentRequest(item) {
            if (!item || typeof item !== 'object') return null;
            // Normalise type: map legacy 'team' to teamNeedsJerseys; keep other valid values as-is
            var rawType;
            if (item.type === 'freeAgent') {
                rawType = 'freeAgent';
            } else if (item.type === 'teamHasJerseys') {
                rawType = 'teamHasJerseys';
            } else {
                rawType = 'teamNeedsJerseys';
            }
            return {
                id: String(item.id || (window.crypto && typeof window.crypto.randomUUID === 'function' ? window.crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function(c) { return (c ^ (window.crypto || crypto).getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16); }))).trim(),
                name: String(item.name || '').trim(),
                email: String(item.email || '').trim(),
                phone: String(item.phone || '').trim(),
                type: rawType,
                method: item.method === 'cashapp' || item.method === 'venmo' ? item.method : 'paypal',
                teamName: String(item.teamName || '').trim(),
                teamMembers: String(item.teamMembers || '').trim(),
                teamYears: String(item.teamYears || '').trim(),
                offPosition: String(item.offPosition || '').trim(),
                defPosition: String(item.defPosition || '').trim(),
                experience: String(item.experience || '').trim(),
                paymentUsername: String(item.paymentUsername || '').trim(),
                status: String(item.status || 'pending').toLowerCase() === 'approved'
                    ? 'approved'
                    : (String(item.status || 'pending').toLowerCase() === 'denied' ? 'denied' : 'pending'),
                submittedAt: item.submittedAt ? String(item.submittedAt) : '',
                reviewedAt: item.reviewedAt ? String(item.reviewedAt) : ''
            };
        }

        function normalizePaymentRequestList(list) {
            if (!Array.isArray(list)) return [];
            return list.map(normalizePaymentRequest).filter(Boolean).sort(function(a, b) {
                return new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime();
            });
        }

        function mapPaymentSignupRow(row) {
            return normalizePaymentRequest({
                id: row && row.id,
                name: row && row.name,
                email: row && row.email,
                phone: row && row.phone,
                type: row && row.type,
                method: row && row.method,
                teamName: row && row.team_name,
                teamMembers: row && row.team_members,
                teamYears: row && row.team_years,
                offPosition: row && row.off_position,
                defPosition: row && row.def_position,
                experience: row && row.experience,
                paymentUsername: row && row.payment_username,
                status: row && row.status,
                submittedAt: row && row.submitted_at,
                reviewedAt: row && row.reviewed_at
            });
        }

        function mapPaymentSignupRecord(record) {
            var normalized = normalizePaymentRequest(record);
            return {
                id: normalized.id,
                name: normalized.name,
                email: normalized.email,
                phone: normalized.phone,
                type: normalized.type,
                method: normalized.method,
                team_name: normalized.teamName,
                team_members: normalized.teamMembers,
                team_years: normalized.teamYears,
                off_position: normalized.offPosition,
                def_position: normalized.defPosition,
                experience: normalized.experience,
                payment_username: normalized.paymentUsername,
                status: normalized.status,
                submitted_at: normalized.submittedAt || new Date().toISOString(),
                reviewed_at: normalized.reviewedAt || null
            };
        }

        function loadPaymentRequests() {
            return normalizePaymentRequestList(paymentRequestsState);
        }

        async function fetchPaymentRequestsFromSupabase() {
            var client = getSiteSupabaseClient();
            if (!client) return null;
            var config = getSiteSupabaseConfig();
            try {
                var response = await client
                    .from(config.registrationsTable)
                    .select('id, name, email, phone, type, method, team_name, team_members, team_years, off_position, def_position, experience, payment_username, status, submitted_at, reviewed_at')
                    .order('submitted_at', { ascending: true });
                if (response.error) {
                    logPaymentSupabaseError('Select', 'Failed to fetch signup rows from table "' + config.registrationsTable + '".', response.error);
                    return null;
                }
                var rows = Array.isArray(response.data) ? response.data : [];
                console.info('[Signup][Supabase][Select] Success.', { rows: rows.length });
                return rows.map(mapPaymentSignupRow).filter(Boolean);
            } catch (err) {
                logPaymentSupabaseError('Select', 'Unexpected failure while fetching signup rows.', err);
                return null;
            }
        }

        async function persistPaymentRequestsToSupabase(list) {
            var client = getSiteSupabaseClient();
            if (!client) return { ok: false, errorMessage: 'Supabase client is not configured.' };
            var config = getSiteSupabaseConfig();
            try {
                var rows = normalizePaymentRequestList(list).map(mapPaymentSignupRecord);
                console.info('[Signup][Supabase][Insert] Inserting into table "' + config.registrationsTable + '", row count: ' + rows.length);
                var response = await client
                    .from(config.registrationsTable)
                    .upsert(rows, { onConflict: 'id' });
                if (response.error) {
                    logPaymentSupabaseError('Insert', 'Failed to insert/update signup rows in table "' + config.registrationsTable + '".', response.error);
                    return { ok: false, errorMessage: response.error.message || 'Unknown Supabase error.' };
                }
                console.info('[Signup][Supabase][Insert] Success.', { rows: rows.length });
                return { ok: true };
            } catch (err) {
                logPaymentSupabaseError('Insert', 'Unexpected failure while saving signup rows.', err);
                return { ok: false, errorMessage: (err && err.message) || 'Unexpected error while saving signup.' };
            }
        }

        async function syncPaymentRequestsFromSupabase() {
            var remoteRequests = await fetchPaymentRequestsFromSupabase();
            if (remoteRequests === null) return { synced: false, source: 'supabase-error' };
            paymentRequestsState = normalizePaymentRequestList(remoteRequests);
            renderAdminPaymentRequests();
            renderAdminSignupNotifications();
            logPaymentSignupEvent('info', 'Loaded signup requests from Supabase.', { count: paymentRequestsState.length });
            return { synced: true, source: 'supabase', count: paymentRequestsState.length };
        }

        async function savePaymentRequests(list, options) {
            var normalized = normalizePaymentRequestList(list);
            var skipRemote = !!(options && options.skipRemote);
            var previous = paymentRequestsState.slice();
            paymentRequestsState = normalized;
            renderAdminPaymentRequests();
            renderAdminSignupNotifications();
            if (skipRemote) return { ok: true };
            var result = await persistPaymentRequestsToSupabase(normalized);
            if (!result.ok) {
                paymentRequestsState = previous;
                renderAdminPaymentRequests();
                renderAdminSignupNotifications();
                logPaymentSignupEvent('warn', 'Signup change was not persisted to Supabase; reverting local state.');
                return result;
            }
            return { ok: true };
        }

        function renderAdminSignupNotifications() {
            const notice = document.getElementById('adminSignupNotification');
            if (!notice) return;
            if (!isAdminLoggedIn()) {
                notice.style.display = 'none';
                notice.textContent = '';
                return;
            }
            const members = loadMembers();
            const requests = loadPaymentRequests();
            const pendingMembers = members.filter(function(member) {
                return normalizeMemberStatus(member && member.status) === 'pending';
            }).length;
            const pendingPayments = requests.filter(function(request) {
                return String((request && request.status) || 'pending').toLowerCase() === 'pending';
            }).length;
            const totalPending = pendingMembers + pendingPayments;
            notice.style.display = 'block';
            if (totalPending > 0) {
                notice.style.background = '#f57c00';
                notice.textContent = totalPending + ' new signup' + (totalPending === 1 ? '' : 's') + ' waiting for review (' + pendingMembers + ' user account' + (pendingMembers === 1 ? '' : 's') + ', ' + pendingPayments + ' payment request' + (pendingPayments === 1 ? '' : 's') + ').';
                return;
            }
            notice.style.background = '#2e7d32';
            notice.textContent = 'No new signups waiting for review.';
        }

        function updatePaymentTypeFields() {
            ensurePaymentSignupUI();
            const typeInput = document.getElementById('payType');
            const teamMembersWrap = document.getElementById('teamMemberCountWrap');
            const teamYearsWrap = document.getElementById('teamYearsWrap');
            const teamNameWrap = document.getElementById('teamNameWrap');
            const positionsRow = document.getElementById('freeAgentPositionsRow');
            const offPosWrap = document.getElementById('freeAgentOffPosWrap');
            const defPosWrap = document.getElementById('freeAgentDefPosWrap');
            const experienceWrap = document.getElementById('freeAgentExperienceWrap');
            const teamMembersInput = document.getElementById('payTeamMembers');
            const teamYearsInput = document.getElementById('payTeamYears');
            const teamNameInput = document.getElementById('payTeamName');
            const offPosInput = document.getElementById('payOffPosition');
            const defPosInput = document.getElementById('payDefPosition');
            const experienceInput = document.getElementById('payExperience');
            const nameLabel = document.getElementById('payNameLabel');
            const emailLabel = document.getElementById('payEmailLabel');
            const nameInput = document.getElementById('payName');
            const emailInput = document.getElementById('payEmail');
            if (!typeInput || !teamMembersWrap || !teamYearsWrap || !experienceWrap) return;

            const isTeam = isTeamRegistrationType(typeInput.value);
            const isFreeAgent = typeInput.value === 'freeAgent';
            teamMembersWrap.style.display = isTeam ? 'block' : 'none';
            teamYearsWrap.style.display = isTeam ? 'block' : 'none';
            if (teamNameWrap) teamNameWrap.style.display = isTeam ? 'block' : 'none';
            // Toggle the positions row wrapper (preferred) or fall back to individual wrappers
            if (positionsRow) {
                positionsRow.style.display = isFreeAgent ? 'block' : 'none';
            } else {
                if (offPosWrap) offPosWrap.style.display = isFreeAgent ? 'block' : 'none';
                if (defPosWrap) defPosWrap.style.display = isFreeAgent ? 'block' : 'none';
            }
            experienceWrap.style.display = isFreeAgent ? 'block' : 'none';
            if (teamMembersInput) teamMembersInput.required = isTeam;
            if (teamYearsInput) teamYearsInput.required = isTeam;
            if (teamNameInput) teamNameInput.required = isTeam;
            if (offPosInput) offPosInput.required = isFreeAgent;
            if (defPosInput) defPosInput.required = isFreeAgent;
            if (experienceInput) experienceInput.required = isFreeAgent;
            if (isTeam) {
                if (offPosInput) offPosInput.value = '';
                if (defPosInput) defPosInput.value = '';
                if (experienceInput) experienceInput.value = '';
            }

            if (nameLabel && nameLabel.dataset) {
                nameLabel.textContent = isTeam ? (nameLabel.dataset.teamLabel || nameLabel.textContent) : (nameLabel.dataset.freeLabel || nameLabel.textContent);
            }
            if (emailLabel && emailLabel.dataset) {
                emailLabel.textContent = isTeam ? (emailLabel.dataset.teamLabel || emailLabel.textContent) : (emailLabel.dataset.freeLabel || emailLabel.textContent);
            }
            if (nameInput && nameInput.dataset) {
                nameInput.placeholder = isTeam ? (nameInput.dataset.teamPlaceholder || nameInput.placeholder) : (nameInput.dataset.freePlaceholder || nameInput.placeholder);
            }
            if (emailInput && emailInput.dataset) {
                emailInput.placeholder = isTeam ? (emailInput.dataset.teamPlaceholder || emailInput.placeholder) : (emailInput.dataset.freePlaceholder || emailInput.placeholder);
            }

            if (teamMembersInput && Number(teamMembersInput.value || '0') > 16) {
                teamMembersInput.value = '16';
            }

            if (!isTeam) {
                if (teamMembersInput) teamMembersInput.value = '';
                if (teamYearsInput) teamYearsInput.value = '';
                if (teamNameInput) teamNameInput.value = '';
            }

            if (!isFreeAgent) {
                if (offPosInput) offPosInput.value = '';
                if (defPosInput) defPosInput.value = '';
                if (experienceInput) experienceInput.value = '';
            }
        }

        function updatePaymentMethodLink() {
            loadPaymentLinks();
            const method = (document.getElementById('payMethod') || {}).value || '';
            const type = (document.getElementById('payType') || {}).value || '';
            const linkWrap = document.getElementById('payMethodLinkWrap');
            const submitBtn = document.getElementById('paySubmitBtn');
            const usernameWrap = document.getElementById('paymentUsernameWrap');
            const usernameInput = document.getElementById('paymentUsername');
            const amountLabel = type === 'teamNeedsJerseys' ? ' ($500)' : type === 'teamHasJerseys' ? ' ($350)' : ' ($50)';
            if (method === 'cashapp') {
                if (submitBtn) submitBtn.textContent = 'Submit & Open CashApp' + amountLabel;
            } else if (method === 'venmo') {
                if (submitBtn) submitBtn.textContent = 'Submit & Open Venmo' + amountLabel;
            } else if (method === 'paypal') {
                if (submitBtn) submitBtn.textContent = 'Continue To PayPal' + amountLabel;
            } else {
                if (submitBtn) submitBtn.textContent = 'Continue To Payment';
            }
            if (linkWrap) {
                linkWrap.style.display = 'none';
            }
            if (usernameWrap) {
                const needsUsername = method === 'cashapp' || method === 'venmo';
                usernameWrap.style.display = needsUsername ? 'block' : 'none';
                if (usernameInput) usernameInput.required = needsUsername;
                if (!needsUsername && usernameInput) usernameInput.value = '';
            }
        }


        function renderAdminPaymentRequests() {
            try {
                const tbody = document.getElementById('adminPaymentsTbody');
                if (!tbody) return;
                const items = loadPaymentRequests();
                tbody.innerHTML = '';
                if (!items.length) {
                    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#777; padding:20px;">No payment requests yet.</td></tr>';
                    return;
                }
                items.forEach((p, idx) => {
                    const tr = document.createElement('tr');
                    const label = REGISTRATION_TYPE_LABELS[p.type] || p.type || 'Unknown';
                    const positionInfo = p.offPosition
                        ? 'Off: ' + p.offPosition + ' | Def: ' + (p.defPosition || 'N/A')
                        : (p.position ? 'Position: ' + p.position : '');
                    const isTeam = isTeamRegistrationType(p.type);
                    const details = isTeam
                        ? 'Team Name: ' + (p.teamName || 'N/A') + ' | Team Members: ' + (p.teamMembers || 'N/A') + ' | Team Years: ' + (p.teamYears || 'N/A')
                        : (positionInfo ? positionInfo + ' | ' : '') + 'Experience: ' + (p.experience || 'N/A');
                    const methodLabels = { paypal: 'PayPal', cashapp: 'CashApp', venmo: 'Venmo' };
                    const payInfo = (methodLabels[p.method] || p.method || '') + (p.paymentUsername ? ' — ' + p.paymentUsername : '');
                    const submitted = p.submittedAt ? new Date(p.submittedAt).toLocaleString() : 'N/A';

                    function appendCell(text, styleText) {
                        const cell = document.createElement('td');
                        cell.textContent = text;
                        if (styleText) cell.style.cssText = styleText;
                        tr.appendChild(cell);
                        return cell;
                    }

                    appendCell(p.name || '');
                    appendCell(p.email || '');
                    appendCell(p.phone || '');
                    appendCell(label);
                    appendCell(details);
                    appendCell(payInfo || 'N/A');
                    appendCell(p.status || 'pending', 'font-weight:700; color:' + (p.status === 'approved' ? '#2e7d32' : '#e65100') + ';');
                    appendCell(submitted);

                    const actionsCell = document.createElement('td');
                    const approveBtn = document.createElement('button');
                    approveBtn.dataset.action = 'approvePayment';
                    approveBtn.dataset.idx = String(idx);
                    approveBtn.className = 'cta-button small';
                    approveBtn.style.marginRight = '6px';
                    approveBtn.textContent = 'Approve';
                    actionsCell.appendChild(approveBtn);

                    const denyBtn = document.createElement('button');
                    denyBtn.dataset.action = 'denyPayment';
                    denyBtn.dataset.idx = String(idx);
                    denyBtn.className = 'cta-button small';
                    denyBtn.style.background = '#777';
                    denyBtn.textContent = 'Deny';
                    actionsCell.appendChild(denyBtn);

                    tr.appendChild(actionsCell);
                    tbody.appendChild(tr);
                });

                tbody.querySelectorAll('button[data-action="approvePayment"]').forEach(btn => {
                    btn.addEventListener('click', async function() {
                        const idx = Number(this.dataset.idx);
                        const items = loadPaymentRequests();
                        if (!items[idx]) return;
                        items[idx].status = 'approved';
                        items[idx].reviewedAt = new Date().toISOString();
                        try {
                            const saved = await savePaymentRequests(items);
                            if (!saved.ok) {
                                alert('Approval update failed: ' + (saved.errorMessage || 'Check console for details.'));
                            }
                            logPaymentSignupEvent('info', 'Admin approved signup request.', { index: idx, savedToSupabase: saved.ok, rows: items.length });
                        } catch (err) {
                            alert('Failed to save approval update. Please try again.');
                            logPaymentSignupEvent('error', 'Failed saving admin approval update.', err);
                        }
                    });
                });

                tbody.querySelectorAll('button[data-action="denyPayment"]').forEach(btn => {
                    btn.addEventListener('click', async function() {
                        const idx = Number(this.dataset.idx);
                        const items = loadPaymentRequests();
                        if (!items[idx]) return;
                        items[idx].status = 'denied';
                        items[idx].reviewedAt = new Date().toISOString();
                        try {
                            const saved = await savePaymentRequests(items);
                            if (!saved.ok) {
                                alert('Denial update failed: ' + (saved.errorMessage || 'Check console for details.'));
                            }
                            logPaymentSignupEvent('info', 'Admin denied signup request.', { index: idx, savedToSupabase: saved.ok, rows: items.length });
                        } catch (err) {
                            alert('Failed to save denial update. Please try again.');
                            logPaymentSignupEvent('error', 'Failed saving admin denial update.', err);
                        }
                    });
                });
            } catch (err) {
                logPaymentSignupEvent('error', 'Failed to render admin signup/payment table.', err);
            }
        }

        // Simple password hashing (SHA-256) with fallback
        async function hashPw(password) {
            if (window.crypto && crypto.subtle) {
                const enc = new TextEncoder();
                const buf = await crypto.subtle.digest('SHA-256', enc.encode(password));
                return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
            }
            return password; // fallback (not secure)
        }

        // --- UI: show saved logo and check auth states on load ---
        window.addEventListener('load', function() {
            renderDocumentsList();
            const hasMemberSession = sessionStorage.getItem('memberLoggedIn') === 'true';
            if (hasMemberSession && sessionStorage.getItem('adminLoggedIn') === 'true') {
                clearAdminSession();
            }
            // admin
            if (isAdminLoggedIn()) {
                const stored = sessionStorage.getItem('adminUsername');
                const adminNameEl = document.getElementById('adminNameDisplay');
                if (adminNameEl) adminNameEl.textContent = stored ? '(' + stored + ')' : '';
                setAdminHeaderVisible(true);
                document.getElementById('adminOnly').classList.add('visible');
                document.querySelectorAll('.admin-only').forEach(function(el) { el.classList.add('visible'); });
                const scheduleAdminPanel = document.getElementById('leagueScheduleAdminPanel');
                if (scheduleAdminPanel) scheduleAdminPanel.classList.add('visible');
                document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.add('visible'));
                enablePageEdit(true);
                renderUsersTableForAdmin();
                renderDocsAdmin && renderDocsAdmin();
                renderAllStats && renderAllStats();
                renderAdminPaymentRequests && renderAdminPaymentRequests();
                renderAdminSignupNotifications && renderAdminSignupNotifications();
                renderPayPalSettings && renderPayPalSettings();
                bindPayPalSettingsControls && bindPayPalSettingsControls();
                bindSignupSeasonAdminControls && bindSignupSeasonAdminControls();
                populateCtaButtonEditor && populateCtaButtonEditor();
                bindCtaButtonControls && bindCtaButtonControls();
                // restore to hashed page or default to the admin dashboard
                const h = window.location.hash ? window.location.hash.substring(1) : 'documentsAdmin';
                showPage(ALL_PAGE_IDS.indexOf(h) !== -1 ? h : 'documentsAdmin');
            } else {
                // Non-admin: full lockdown — no editing visible anywhere
                lockdownForPublic();
                renderAllStats && renderAllStats();
            }
            applySavedBranding();
            applySavedHeroBackground();
            applySavedCtaButton();
            populateFooterAdminSelector();
            ensureSeasonStatsAndRecapUI();
            ensureLeagueScheduleResultsUI();
            ensureAdminBrandingUI();
            enforceNonEditableAdminUI();
            bindAdminBrandingControls();
            bindPayPalSettingsControls();
            bindSignupSeasonAdminControls();
            bindCtaButtonControls();
            renderPayPalSettings();
            renderPaymentMethodsInfo();
            renderSignupSeasonAvailability();
            // member
            if (sessionStorage.getItem('memberLoggedIn') === 'true') {
                const username = sessionStorage.getItem('memberUsername');
                const isGuest = sessionStorage.getItem('memberIsGuest') === 'true';
                document.getElementById('memberHeader').style.display = 'block';
                document.getElementById('memberNameDisplay').textContent = isGuest ? (username + ' (Guest)') : username;
                if (!isGuest) {
                    const navProfile = document.getElementById('navProfile');
                    if (navProfile) navProfile.classList.add('visible');
                    showPage('myProfile');
                    renderMyProfile && renderMyProfile();
                } else {
                    showPage('guestArea');
                }
            } else {
                document.getElementById('memberHeader').style.display = 'none';
            }
            updateFooterAdminState();
            updateNavQuickSelectOptions(window.location.hash ? window.location.hash.substring(1) : 'home');
            ensureNavHamburger();
            updateHeaderScrollState();
        });

        // --- Admin login (existing) ---


        // --- Logo upload handling (admin-only) ---


        // --- Members: registration & login UI ---
        function showMemberModal() {
            document.getElementById('memberModal').style.display = 'flex';
            document.getElementById('memberModal').classList.remove('hidden');
            document.getElementById('memberAuthError').textContent = '';
            // default to register view
            document.getElementById('memberRegisterForm').style.display = 'block';
            document.getElementById('memberLoginForm').style.display = 'none';
            // clear registration signature area when opening
            const rCanvas = document.getElementById('regSignatureCanvas');
            if (rCanvas && rCanvas.getContext) { const rCtx = rCanvas.getContext('2d'); rCtx.clearRect(0,0,rCanvas.width,rCanvas.height); }
            const rTyped = document.getElementById('regTypedSignature'); if (rTyped) rTyped.value = '';
            // if currently browsing as guest, prefill username so conversion is seamless
            try {
                const isGuest = sessionStorage.getItem('memberIsGuest') === 'true';
                const regInput = document.getElementById('regUsername');
                if (isGuest && regInput) regInput.value = sessionStorage.getItem('memberUsername') || '';
                else if (regInput) regInput.value = '';
            } catch (err) { /* ignore in older browsers */ }
        }
        function hideMemberModal() {
            document.getElementById('memberModal').style.display = 'none';
            document.getElementById('memberModal').classList.add('hidden');
        }

        // Registration now uses on-page sections, so no nav modal hook here.

        // Login menu (top-right): open/close + Guest/Admin actions
        function showAdminLoginModal() {
            const lm = document.getElementById('loginModal');
            if (!lm) return;
            // Always start at step 1 (pick admin)
            const pickStep = document.getElementById('adminPickStep');
            const passStep = document.getElementById('adminPasswordStep');
            const usernameEl = document.getElementById('username');
            const passwordEl = document.getElementById('password');
            const errorEl = document.getElementById('loginError');
            if (pickStep) pickStep.style.display = 'block';
            if (passStep) passStep.style.display = 'none';
            if (usernameEl) usernameEl.value = '';
            if (passwordEl) passwordEl.value = '';
            if (errorEl) errorEl.textContent = '';
            lm.classList.remove('hidden');
            lm.style.display = 'flex';
        }

        function toggleLoginDropdown(forceState) {
            const dd = document.getElementById('loginDropdown');
            const btn = document.getElementById('loginMenuBtn');
            if (!dd || !btn) return;
            const isOpen = !dd.classList.contains('hidden');
            const shouldOpen = (typeof forceState === 'boolean') ? forceState : !isOpen;
            dd.style.display = 'block';
            if (shouldOpen) { dd.classList.remove('hidden'); dd.classList.add('visible'); btn.setAttribute('aria-expanded','true'); }
            else { dd.classList.add('hidden'); dd.classList.remove('visible'); btn.setAttribute('aria-expanded','false'); }
        }
        document.getElementById('closeLoginModal')?.addEventListener('click', function(){
            document.getElementById('loginModal').classList.add('hidden');
            document.getElementById('loginModal').style.display = 'none';
        });
        document.getElementById('closeMemberModal')?.addEventListener('click', function(){
            hideMemberModal();
        });
        document.addEventListener('click', function(e) {
            if (e.target.closest('#closeLoginModal')) {
                var loginModal = document.getElementById('loginModal');
                if (loginModal) {
                    loginModal.classList.add('hidden');
                    loginModal.style.display = 'none';
                }
                return;
            }

            if (e.target.closest('#closeMemberModal')) {
                hideMemberModal();
                return;
            }

            if (e.target.closest('#switchToMemberLogin')) {
                e.preventDefault();
                document.getElementById('memberRegisterForm').style.display = 'none';
                document.getElementById('memberLoginForm').style.display = 'block';
                return;
            }

            if (e.target.closest('#switchToMemberRegister')) {
                e.preventDefault();
                document.getElementById('memberRegisterForm').style.display = 'block';
                document.getElementById('memberLoginForm').style.display = 'none';
                return;
            }

            var pickBtn = e.target.closest('.admin-pick-btn');
            if (pickBtn) {
                const adminName = pickBtn.getAttribute('data-admin');
                document.getElementById('username').value = adminName;
                document.getElementById('adminPickedName').textContent = adminName;
                document.getElementById('adminPickStep').style.display = 'none';
                document.getElementById('adminPasswordStep').style.display = 'block';
                document.getElementById('password').value = '';
                document.getElementById('loginError').textContent = '';
                document.getElementById('password').focus();
                return;
            }

            if (e.target.closest('#adminBackBtn')) {
                document.getElementById('adminPasswordStep').style.display = 'none';
                document.getElementById('adminPickStep').style.display = 'block';
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
                document.getElementById('loginError').textContent = '';
                return;
            }

            if (e.target.closest('#navQuickSelectPanel') || e.target.closest('#navHamburger')) {
                e.stopPropagation();
                return;
            }

            var hashAnchor = e.target.closest('a[href^="#"]');
            if (hashAnchor) {
                const href = hashAnchor.getAttribute('href') || '';
                const id = href.substring(1);
                if (id) {
                    e.preventDefault();
                    setNavQuickSelectOpen(false);
                    showPage(id);
                    return;
                }
            }

            toggleLoginDropdown(false);
            setNavQuickSelectOpen(false);
        });
        document.getElementById('siteContent')?.addEventListener('change', function(e) {
            if (e.target.id === 'navQuickSelect') {
                const targetPage = e.target.value;
                if (!targetPage) return;
                setNavQuickSelectOpen(false);
                showPage(targetPage);
                return;
            }
            if (e.target.id === 'payType') {
                updatePaymentTypeFields();
                updatePaymentMethodLink();
                return;
            }
            if (e.target.id === 'payMethod') {
                updatePaymentMethodLink();
            }
        });
        function handleFooterAdminLoginSubmit(e) {
            e.preventDefault();
            const form = e && e.target && e.target.id === 'footerAdminLoginForm'
                ? e.target
                : document.getElementById('footerAdminLoginForm');
            if (!form) return;
            const usernameInput = form.querySelector('#footerAdminUsername') || document.getElementById('footerAdminUsername');
            const passwordInput = form.querySelector('#footerAdminPassword') || document.getElementById('footerAdminPassword');
            const formMessage = form.querySelector('#footerAdminLoginMsg') || document.getElementById('footerAdminLoginMsg');
            const username = usernameInput ? usernameInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            if (formMessage) {
                formMessage.style.color = '#ff6f61';
                formMessage.textContent = '';
            }
            const adminAccount = getMatchingAdminAccount(username, password);
            if (!adminAccount) {
                if (formMessage) formMessage.textContent = 'Invalid admin selection or password';
                return;
            }
            sessionStorage.setItem('adminLoggedIn', 'true');
            sessionStorage.setItem('adminUsername', adminAccount.username);
            if (formMessage) {
                formMessage.style.color = '#7dffb3';
                formMessage.textContent = 'Signed in successfully';
            }
            if (passwordInput) passwordInput.value = '';
            showAdminView();
        }
        document.getElementById('siteContent')?.addEventListener('click', function(e) {
            const logoutBtn = e.target.closest('#footerAdminLogoutBtn');
            if (!logoutBtn) return;
            logout();
        });

        updatePaymentTypeFields();
        updatePaymentMethodLink();

        async function handlePaymentFormSubmit(e) {
            e.preventDefault();
            const availability = await enforceSignupSeasonForSubmission();
            const msg = document.getElementById('paymentMsg');
            if (!availability.allowed) {
                if (msg) {
                    msg.style.color = '#e65100';
                    msg.textContent = availability.message;
                }
                logPaymentSignupEvent('warn', 'Blocked signup submission because the signup window is closed or unavailable.', availability.status || availability.message);
                return;
            }
            const name = document.getElementById('payName').value.trim();
            const email = document.getElementById('payEmail').value.trim();
            const phone = (document.getElementById('payPhone') || {}).value ? document.getElementById('payPhone').value.trim() : '';
            const type = document.getElementById('payType').value;
            const method = (document.getElementById('payMethod') || {}).value || '';
            const teamMembers = document.getElementById('payTeamMembers').value.trim();
            const teamYears = document.getElementById('payTeamYears').value.trim();
            const teamName = document.getElementById('payTeamName').value.trim();
            const isTeam = isTeamRegistrationType(type);
            const offPosition = isTeam ? '' : document.getElementById('payOffPosition').value.trim();
            const defPosition = isTeam ? '' : document.getElementById('payDefPosition').value.trim();
            const experience = isTeam ? '' : document.getElementById('payExperience').value.trim();
            const paymentUsername = document.getElementById('paymentUsername').value.trim();
            loadPaymentLinks();
            loadPaymentNotificationSettings();
            let link = '';
            if (method === 'cashapp') {
                link = PAYMENT_LINKS.cashApp || '';
            } else if (method === 'venmo') {
                link = PAYMENT_LINKS.venmo || '';
            } else {
                // $500 only for teamNeedsJerseys; all others are $50
                link = type === 'teamNeedsJerseys' ? PAYMENT_LINKS.team : PAYMENT_LINKS.freeAgent;
            }
            logPaymentSignupEvent('info', 'Signup form submit received.', { type: type, method: method, email: email });

            if (!phone) {
                if (msg) {
                    msg.style.color = '#e65100';
                    msg.textContent = 'Please enter your phone number so we can reach you.';
                }
                return;
            }

            if (isTeam && (!teamName || !teamMembers || !teamYears)) {
                if (msg) {
                    msg.style.color = '#e65100';
                    msg.textContent = 'Team registrations must provide the team name, team members, and years playing together.';
                }
                return;
            }

            if (isTeam && Number(teamMembers) > 16) {
                if (msg) {
                    msg.style.color = '#e65100';
                    msg.textContent = 'Team registrations cannot exceed 16 players.';
                }
                return;
            }

            if (type === 'freeAgent' && (!offPosition || !defPosition || !experience)) {
                if (msg) {
                    msg.style.color = '#e65100';
                    msg.textContent = 'Free agents must provide their offensive position, defensive position, and flag football experience.';
                }
                return;
            }

            if ((method === 'cashapp' || method === 'venmo') && !paymentUsername) {
                if (msg) {
                    msg.style.color = '#e65100';
                    msg.textContent = 'Please enter your CashApp or Venmo username for the account sending payment.';
                }
                return;
            }

            const submittedAt = new Date().toISOString();

            const requests = loadPaymentRequests();
            requests.push({
                id: window.crypto && typeof window.crypto.randomUUID === 'function'
                    ? window.crypto.randomUUID()
                    : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function(c) { return (c ^ (window.crypto || crypto).getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16); }),
                name,
                email,
                phone,
                type,
                method,
                teamName,
                teamMembers,
                teamYears,
                offPosition,
                defPosition,
                experience,
                paymentUsername,
                status: 'pending',
                submittedAt: submittedAt
            });
            const saveResult = await savePaymentRequests(requests);
            if (!saveResult.ok) {
                if (msg) {
                    msg.style.color = '#e65100';
                    msg.textContent = 'Signup could not be saved: ' + (saveResult.errorMessage || 'Unknown error. Check console for details.');
                }
                logPaymentSignupEvent('warn', 'Signup insert failed and no browser-only fallback was used.', { submittedAt: submittedAt, email: email, errorMessage: saveResult.errorMessage });
                return;
            }
            logPaymentSignupEvent('info', 'Signup persisted to Supabase.', { submittedAt: submittedAt, email: email, rows: requests.length });

            const notificationResult = await sendAdminPaymentNotification({
                name,
                email,
                phone,
                type,
                teamName,
                teamMembers,
                teamYears,
                offPosition,
                defPosition,
                experience,
                method,
                paymentUsername,
                paypalLink: link,
                submittedAt: submittedAt
            });
            if (!notificationResult.sent) {
                logPaymentSignupEvent('warn', 'Admin payment notification was not sent.', notificationResult);
            }

            const methodLabels = { paypal: 'PayPal', cashapp: 'CashApp', venmo: 'Venmo' };
            const methodLabel = methodLabels[method] || 'Payment';

            if (!link || !/^https:\/\//i.test(link)) {
                if (msg) {
                    msg.style.color = '#e65100';
                    msg.textContent = notificationResult.sent
                        ? 'Payment info submitted and admin was notified. ' + methodLabel + ' link is not configured yet.'
                        : 'Payment info submitted for admin approval. ' + methodLabel + ' link is not configured yet.';
                }
                return;
            }
            if (msg) {
                msg.style.color = 'green';
                msg.textContent = notificationResult.sent
                    ? 'Payment submitted. Admin was notified and you are being redirected to ' + methodLabel + '.'
                    : 'Payment submitted. Redirecting to ' + methodLabel + '... Approval is still required before registration.';
            }
            logPaymentSignupEvent('info', 'Signup submission completed successfully.', { method: method, redirect: link });
            window.open(link, '_blank', 'noopener,noreferrer');
        }
        document.getElementById('siteContent')?.addEventListener('submit', function(e) {
            if (e.target.id !== 'paymentForm') return;
            handlePaymentFormSubmit(e);
        });

        // Member register
        document.getElementById('memberRegisterForm').addEventListener('submit', async function(e){
            e.preventDefault();
            document.getElementById('memberAuthError').textContent = '';
            document.getElementById('memberAuthError').style.color = '#ff6f61';
            const username = document.getElementById('regUsername').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regPasswordConfirm').value;
            const firstName = document.getElementById('regFirstName').value.trim();
            const lastName = document.getElementById('regLastName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const team = document.getElementById('regTeam').value.trim();

            if (!username || !password) { document.getElementById('memberAuthError').textContent = 'Username and password required'; return; }
            if (password !== confirm) { document.getElementById('memberAuthError').textContent = 'Passwords do not match'; return; }

            // require a signature (drawn on canvas or typed)
            const regCanvas = document.getElementById('regSignatureCanvas');
            const regTyped = document.getElementById('regTypedSignature').value.trim();
            const needSignature = isCanvasBlank(regCanvas) && !regTyped;
            if (needSignature) { document.getElementById('memberAuthError').textContent = 'Please provide a signature to complete registration'; return; }

            const members = loadMembers();
            if (members.find(m => m.username.toLowerCase() === username.toLowerCase())) { document.getElementById('memberAuthError').textContent = 'Username already taken'; return; }

            const pwHash = await hashPw(password);
            const user = {
                username,
                passwordHash: pwHash,
                firstName,
                lastName,
                email,
                team,
                status: 'pending',
                submittedAt: new Date().toISOString()
            };

            // capture signature
            let sigData = null;
            if (!isCanvasBlank(regCanvas)) sigData = regCanvas.toDataURL();
            else if (regTyped) { const tmp = document.createElement('canvas'); tmp.width = 600; tmp.height = 80; const tc = tmp.getContext('2d'); tc.fillStyle = '#000'; tc.font = '28px sans-serif'; tc.fillText(regTyped, 8, 50); sigData = tmp.toDataURL(); }
            if (sigData) user.signedDocs = [{ docId: 'registration', signature: sigData, signedAt: new Date().toISOString(), title: 'Registration Signature' }];

            // if the visitor was a guest, convert that session into this new persistent member
            if (sessionStorage.getItem('memberIsGuest') === 'true') {
                user.convertedFromGuest = true;
                user.guestFrom = sessionStorage.getItem('memberUsername') || null;
                user.convertedAt = new Date().toISOString();
                // clear guest session marker
                sessionStorage.removeItem('memberIsGuest');
            }

            members.push(user);
            saveMembers(members);
            document.getElementById('memberRegisterForm').reset();
            if (regCtx && regCanvas) regCtx.clearRect(0, 0, regCanvas.width, regCanvas.height);
            document.getElementById('memberAuthError').style.color = '#2e7d32';
            document.getElementById('memberAuthError').textContent = 'Registration submitted and pending admin approval.';
            document.getElementById('memberRegisterForm').style.display = 'none';
            document.getElementById('memberLoginForm').style.display = 'block';
        });

        // Member login
        document.getElementById('memberLoginForm').addEventListener('submit', async function(e){
            e.preventDefault();
            document.getElementById('memberAuthError').style.color = '#ff6f61';
            const username = document.getElementById('memberLoginUsername').value.trim();
            const password = document.getElementById('memberLoginPassword').value;
            const members = loadMembers();
            const pwHash = await hashPw(password);
            const user = members.find(m => m.username === username && m.passwordHash === pwHash);
            if (!user) { document.getElementById('memberAuthError').textContent = 'Invalid username or password'; return; }
            if (user.status === 'pending') { document.getElementById('memberAuthError').textContent = 'Your registration is pending admin approval.'; return; }
            if (user.status === 'denied') { document.getElementById('memberAuthError').textContent = 'Your registration was denied. Please contact an administrator for assistance.'; return; }
            clearAdminSession();
            lockdownForPublic();
            updateFooterAdminState();
            sessionStorage.setItem('memberLoggedIn', 'true');
            sessionStorage.setItem('memberUsername', username);
            hideMemberModal();
            showMemberView();
        });

        // Member view / profile
        function showMemberView() {
            const username = sessionStorage.getItem('memberUsername');
            if (!username) return;
            const isGuest = sessionStorage.getItem('memberIsGuest') === 'true';
            document.getElementById('memberHeader').style.display = 'block';
            document.getElementById('memberNameDisplay').textContent = isGuest ? (username + ' (Guest)') : username;
            if (isGuest) {
                showPage('guestArea');
            } else {
                const navProfile = document.getElementById('navProfile');
                if (navProfile) navProfile.classList.add('visible');
                showPage('myProfile');
                renderMyProfile();
            }
            updateNavQuickSelectOptions();
        }
        function memberLogout() {
            sessionStorage.removeItem('memberLoggedIn');
            sessionStorage.removeItem('memberUsername');
            sessionStorage.removeItem('memberIsGuest');
            document.getElementById('memberHeader').style.display = 'none';
            const navProfile = document.getElementById('navProfile');
            if (navProfile) navProfile.classList.remove('visible');
            updateNavQuickSelectOptions('home');
            showPage('home');
        }

        // Guest login disabled (admin/member login only).
        // open registration WITHOUT logging the guest out — we'll convert the session on submit
        document.getElementById('guestRegisterBtn')?.addEventListener('click', function(){
            showMemberModal();
            document.getElementById('memberRegisterForm').style.display = 'block';
            document.getElementById('memberLoginForm').style.display = 'none';
            const isGuest = sessionStorage.getItem('memberIsGuest') === 'true';
            if (isGuest) {
                const guestName = sessionStorage.getItem('memberUsername') || '';
                document.getElementById('regUsername').value = guestName;
            } else {
                document.getElementById('regUsername').value = '';
            }
        });
        // preview team logo when file chosen
        document.querySelectorAll('.team-logo-input').forEach(inp => {
            inp.addEventListener('change', function() {
                const file = this.files[0];
                const container = this.parentElement;
                const img = container ? container.querySelector('img.team-logo') : null;
                if (file && img) {
                    const reader = new FileReader();
                    reader.onload = () => { img.src = reader.result; };
                    reader.readAsDataURL(file);
                }
            });
        });
        document.addEventListener('change', function(e) {
            const input = e.target;
            if (!input.classList || !input.classList.contains('schedule-admin-logo-upload')) return;

            const file = input.files && input.files[0];
            if (!file) return;

            const block = input.closest('.schedule-admin-team-block');
            const hiddenInput = block ? block.querySelector('input[type="hidden"][data-key="' + input.dataset.key + '"]') : null;
            const preview = block ? block.querySelector('.schedule-admin-logo-preview') : null;
            const emptyState = block ? block.querySelector('.schedule-admin-logo-empty') : null;
            if (!hiddenInput || !preview) return;

            const reader = new FileReader();
            reader.onload = function(ev) {
                hiddenInput.value = ev.target.result;
                preview.src = ev.target.result;
                preview.classList.remove('hidden');
                if (emptyState) emptyState.style.display = 'none';
                markUnsaved();
            };
            reader.readAsDataURL(file);
        });
        var standingsAdminPanel = document.getElementById('leagueStandingsAdminPanel');
        standingsAdminPanel?.addEventListener('change', function(e) {
            const input = e.target;
            if (!input.classList || !input.classList.contains('standings-admin-logo-upload')) return;

            const file = input.files && input.files[0];
            if (!file) return;

            const row = input.closest('tr');
            const teamInput = row ? row.querySelector('input[data-key="team"]') : null;
            const teamName = teamInput ? String(teamInput.value || '').trim() : '';
            if (!teamName) {
                alert('Please enter a team name before uploading a logo.');
                input.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(ev) {
                const dataUrl = ev && ev.target ? ev.target.result : '';
                if (!dataUrl) return;
                compressImageDataUrl(dataUrl, STATS_TEAM_LOGO_MAX_WIDTH, STATS_TEAM_LOGO_MAX_HEIGHT, STATS_TEAM_LOGO_QUALITY).then(function(compressed) {
                    setStatsTeamLogo(teamName, compressed);
                    const preview = row ? row.querySelector('.standings-admin-logo-preview') : null;
                    if (preview) preview.innerHTML = renderStandingsTeamLogo(teamName);
                    renderLeagueStandingsPublic();
                    markUnsaved();
                }).catch(function(error) {
                    console.error('Failed to process standings team logo upload.', error);
                    alert('Unable to process the selected image. Please select a valid image file and try again.');
                });
            };
            reader.readAsDataURL(file);
        });
        document.getElementById('guestLogoutBtn')?.addEventListener('click', memberLogout);

        // Render profile for logged-in member
        function renderMyProfile() {
            const username = sessionStorage.getItem('memberUsername');
            if (!username) return;
            const members = loadMembers();
            const user = members.find(u => u.username === username);
            if (!user) return;
            document.getElementById('mpUsername').value = user.username;
            document.getElementById('mpFirstName').value = user.firstName || '';
            document.getElementById('mpLastName').value = user.lastName || '';
            document.getElementById('mpEmail').value = user.email || '';
            document.getElementById('mpTeam').value = user.team || '';
            document.getElementById('mpPassword').value = '';
            document.getElementById('mpMsg').textContent = '';
        }

        // Save profile changes
        document.getElementById('myProfileForm').addEventListener('submit', async function(e){
            e.preventDefault();
            const username = document.getElementById('mpUsername').value;
            const members = loadMembers();
            const user = members.find(u => u.username === username);
            if (!user) return;
            user.firstName = document.getElementById('mpFirstName').value.trim();
            user.lastName = document.getElementById('mpLastName').value.trim();
            user.email = document.getElementById('mpEmail').value.trim();
            user.team = document.getElementById('mpTeam').value.trim();
            const newPw = document.getElementById('mpPassword').value;
            if (newPw) user.passwordHash = await hashPw(newPw);
            saveMembers(members);
            document.getElementById('mpMsg').textContent = 'Profile saved.';
            setTimeout(()=> document.getElementById('mpMsg').textContent = '', 3000);
        });

        // --- Admin: render members inside Users table and allow inline edits/delete ---
        function renderUsersTableForAdmin() {
            const tbody = document.getElementById('usersTbody');
            if (!tbody) return;
            const members = loadMembers();
            const usersTable = tbody.closest('table');
            const usersTableColumnCount = Math.max(1, usersTable ? usersTable.querySelectorAll('thead th').length : 0);
            tbody.innerHTML = '';
            if (members.length === 0) {
                tbody.innerHTML = '<tr><td colspan="' + usersTableColumnCount + '" style="text-align:center; color:#777; padding:20px;">No registered members yet.</td></tr>';
                return;
            }
            function statusBadge(status) {
                if (status === 'approved') return '<span style="font-weight:700; color:#2e7d32;">Approved</span>';
                if (status === 'denied') return '<span style="font-weight:700; color:#c62828;">Denied</span>';
                return '<span style="font-weight:700; color:#e65100;">Pending</span>';
            }
            members.forEach((m, idx) => {
                const status = normalizeMemberStatus(m.status);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><input data-idx="${idx}" data-field="username" value="${m.username}" readonly></td>
                    <td><input data-idx="${idx}" data-field="firstName" value="${m.firstName || ''}"></td>
                    <td><input data-idx="${idx}" data-field="lastName" value="${m.lastName || ''}"></td>
                    <td><input data-idx="${idx}" data-field="email" value="${m.email || ''}"></td>
                    <td><input data-idx="${idx}" data-field="team" value="${m.team || ''}"></td>
                    <td>${statusBadge(status)}</td>
                    <td style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        ${status !== 'approved' ? '<button data-action="approveMember" data-idx="' + idx + '" style="background:#2e7d32;color:#fff;border:none;padding:6px;border-radius:4px;cursor:pointer;">Approve</button>' : ''}
                        ${status !== 'denied' ? '<button data-action="denyMember" data-idx="' + idx + '" style="background:#777;color:#fff;border:none;padding:6px;border-radius:4px;cursor:pointer;">Deny</button>' : ''}
                        <button data-action="delete" data-idx="${idx}" style="background:#e65100;color:#fff;border:none;padding:6px;border-radius:4px;cursor:pointer;">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            // attach events
            tbody.querySelectorAll('input[data-field]').forEach(inp => {
                inp.addEventListener('input', function(e){
                    const idx = Number(this.dataset.idx);
                    const field = this.dataset.field;
                    const members = loadMembers();
                    members[idx][field] = this.value;
                    saveMembers(members);
                });
            });
            tbody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', function(){
                    const idx = Number(this.dataset.idx);
                    const members = loadMembers();
                    members.splice(idx, 1);
                    saveMembers(members);
                });
            });
            tbody.querySelectorAll('button[data-action="approveMember"]').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idx = Number(this.dataset.idx);
                    const members = loadMembers();
                    if (!members[idx]) return;
                    members[idx].status = 'approved';
                    members[idx].reviewedAt = new Date().toISOString();
                    saveMembers(members);
                });
            });
            tbody.querySelectorAll('button[data-action="denyMember"]').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idx = Number(this.dataset.idx);
                    const members = loadMembers();
                    if (!members[idx]) return;
                    members[idx].status = 'denied';
                    members[idx].reviewedAt = new Date().toISOString();
                    saveMembers(members);
                });
            });
        }

        // --- Member logout already defined above as memberLogout() ---

        // --- Documents (admin upload + member signing) ---
        let documentIdCounter = 0;
        const DOCUMENTS_STORAGE_FOLDER = 'documents';
        const DOCUMENTS_STORAGE_CACHE_CONTROL = '3600';
        let documentsSaveToken = 0;

        function logDocumentSupabaseError(type, message, error) {
            console.error('[Documents][Supabase][' + type + '] ' + message, error || '');
            logSupabaseRlsHint('Documents', error);
        }

        function generateDocumentId() {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return 'doc_' + window.crypto.randomUUID();
            }
            documentIdCounter += 1;
            return 'doc_' + Date.now() + '_' + documentIdCounter + '_' + Math.random().toString(36).slice(2, 10);
        }

        function sanitizeDocumentFileName(name) {
            var rawName = String(name || 'document').trim() || 'document';
            var extensionMatch = rawName.match(/(\.[^.]+)$/);
            var rawExtension = extensionMatch ? extensionMatch[1] : '';
            var baseName = extensionMatch ? rawName.slice(0, -rawExtension.length) : rawName;
            var safeBaseName = String(baseName || 'document')
                .toLowerCase()
                .replace(/[^a-z0-9._-]+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '') || 'document';
            var safeExtension = String(rawExtension || '')
                .toLowerCase()
                .replace(/[^.a-z0-9]+/g, '');
            if (safeExtension && safeExtension.charAt(0) !== '.') safeExtension = '.' + safeExtension;
            return safeBaseName + safeExtension;
        }

        function buildDocumentPublicUrl(storagePath) {
            if (!storagePath) return '';
            var client = getSiteSupabaseClient();
            if (!client) return '';
            var config = getSiteSupabaseConfig();
            var publicUrlResponse = client.storage.from(config.documentsBucket).getPublicUrl(storagePath);
            if (publicUrlResponse && publicUrlResponse.error) {
                logDocumentSupabaseError('StorageUrl', 'Failed to generate public URL for "' + storagePath + '".', publicUrlResponse.error);
                return '';
            }
            return publicUrlResponse && publicUrlResponse.data ? String(publicUrlResponse.data.publicUrl || '').trim() : '';
        }

        function normalizeDocumentItem(item) {
            if (!item || typeof item !== 'object') return null;
            var id = String(item.id || '').trim() || generateDocumentId();
            var title = String(item.title || '').trim();
            var filename = String(item.filename || item.name || 'document').trim() || 'document';
            var mimeType = String(item.mimeType || item.type || '').trim();
            var storagePath = String(item.storagePath || item.storage_path || item.path || '').trim();
            var publicUrl = String(item.publicUrl || item.url || item.dataUrl || '').trim() || buildDocumentPublicUrl(storagePath);
            var uploadedAt = String(item.uploadedAt || item.createdAt || item.created_at || new Date().toISOString()).trim();
            if (!publicUrl) return null;
            return {
                id: id,
                title: title,
                filename: filename,
                mimeType: mimeType,
                storagePath: storagePath,
                publicUrl: publicUrl,
                uploadedAt: uploadedAt
            };
        }

        function normalizeDocumentList(list) {
            return (Array.isArray(list) ? list : []).map(normalizeDocumentItem).filter(Boolean);
        }

        function getDocumentUrl(doc) {
            return String(doc && (doc.publicUrl || doc.url || doc.dataUrl) || '').trim();
        }

        function getDocumentUploadMessageEl() {
            return document.getElementById('docUploadMsg');
        }

        function setDocumentUploadMessage(message, isError) {
            var el = getDocumentUploadMessageEl();
            if (!el) return;
            el.textContent = message || '';
            el.style.color = isError ? '#ff6f61' : '#4caf50';
        }

        async function uploadDocumentFileToSupabase(file, id) {
            var client = getSiteSupabaseClient();
            if (!client) return null;
            var config = getSiteSupabaseConfig();
            var safeName = sanitizeDocumentFileName(file && file.name);
            var extension = '';
            var extensionMatch = safeName.match(/(\.[a-z0-9]+)$/);
            if (extensionMatch) extension = extensionMatch[1];
            if (!extension && file && file.type === 'application/pdf') extension = '.pdf';
            if (!extension) extension = '.bin';
            var storagePath = DOCUMENTS_STORAGE_FOLDER + '/' + id + extension;
            try {
                var uploadResponse = await client.storage
                    .from(config.documentsBucket)
                    .upload(storagePath, file, {
                        cacheControl: DOCUMENTS_STORAGE_CACHE_CONTROL,
                        upsert: true,
                        contentType: file && file.type ? file.type : 'application/octet-stream'
                    });
                if (uploadResponse.error) {
                    logDocumentSupabaseError('StorageUpload', 'Failed upload to storage bucket "' + config.documentsBucket + '" at path "' + storagePath + '".', uploadResponse.error);
                    return null;
                }
                var publicUrlResponse = client.storage.from(config.documentsBucket).getPublicUrl(storagePath);
                if (publicUrlResponse && publicUrlResponse.error) {
                    logDocumentSupabaseError('StorageUpload', 'Upload succeeded but public URL generation failed for "' + storagePath + '".', publicUrlResponse.error);
                    return null;
                }
                var publicUrl = publicUrlResponse && publicUrlResponse.data ? publicUrlResponse.data.publicUrl : '';
                if (!publicUrl) {
                    logDocumentSupabaseError('StorageUpload', 'Upload succeeded but public URL could not be generated for "' + storagePath + '".', null);
                    return null;
                }
                return { storagePath: storagePath, url: publicUrl };
            } catch (err) {
                logDocumentSupabaseError('StorageUpload', 'Unexpected failure while uploading document "' + storagePath + '".', err);
                return null;
            }
        }

        async function deleteDocumentFileFromSupabase(storagePath) {
            if (!storagePath || isLocalPreviewMode()) return true;
            var client = getSiteSupabaseClient();
            if (!client) return false;
            var config = getSiteSupabaseConfig();
            try {
                var removeResponse = await client.storage.from(config.documentsBucket).remove([storagePath]);
                if (removeResponse.error) {
                    logDocumentSupabaseError('StorageDelete', 'Failed to delete storage object "' + storagePath + '".', removeResponse.error);
                    return false;
                }
                return true;
            } catch (err) {
                logDocumentSupabaseError('StorageDelete', 'Unexpected failure while deleting storage object "' + storagePath + '".', err);
                return false;
            }
        }

        async function loadDocuments() {
            try {
                if (Array.isArray(documentsState) && documentsState.length) {
                    documentsState = normalizeDocumentList(documentsState);
                    return documentsState.slice();
                }
                var stored = await idbGet('documents');
                if (!stored) return [];
                documentsState = normalizeDocumentList(stored);
                return documentsState.slice();
            } catch (err) { return []; }
        }
        async function saveDocuments(list) {
            const saveToken = ++documentsSaveToken;
            var previousDocuments = Array.isArray(documentsState) ? documentsState.slice() : [];
            documentsState = normalizeDocumentList(list);
            await idbSet('documents', documentsState);
            var persisted = await queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.documents, documentsState, 'Documents');
            if (!persisted && !isLocalPreviewMode()) {
                if (saveToken === documentsSaveToken) {
                    documentsState = previousDocuments;
                    await idbSet('documents', documentsState);
                    await renderDocsAdmin();
                    await renderDocumentsList();
                }
                return false;
            }
            if (saveToken === documentsSaveToken) {
                await renderDocsAdmin();
                await renderDocumentsList();
            }
            return true;
        }

        async function renderDocsAdmin() {
            const tbody = document.getElementById('adminDocsTbody');
            if (!tbody) return;
            const docs = await loadDocuments();
            tbody.innerHTML = '';
            if (docs.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#777; padding:20px;">No documents uploaded.</td></tr>'; return; }
            docs.forEach((d, idx) => {
                const tr = document.createElement('tr');
                const uploaded = new Date(d.uploadedAt).toLocaleString();
                const signedCount = loadMembers().filter(m => (m.signedDocs || []).some(s => s.docId === d.id)).length;
                const titleCell = document.createElement('td');
                titleCell.textContent = d.title || d.filename;
                const fileCell = document.createElement('td');
                const link = document.createElement('a');
                link.href = getDocumentUrl(d);
                link.download = d.filename;
                link.textContent = 'Download';
                fileCell.appendChild(link);
                const uploadedCell = document.createElement('td');
                uploadedCell.textContent = uploaded;
                const signedCell = document.createElement('td');
                signedCell.textContent = String(signedCount);
                const actionsCell = document.createElement('td');
                const button = document.createElement('button');
                button.dataset.action = 'deleteDoc';
                button.dataset.idx = String(idx);
                button.className = 'doc-delete';
                button.type = 'button';
                button.textContent = 'Delete';
                actionsCell.appendChild(button);
                tr.appendChild(titleCell);
                tr.appendChild(fileCell);
                tr.appendChild(uploadedCell);
                tr.appendChild(signedCell);
                tr.appendChild(actionsCell);
                tbody.appendChild(tr);
            });
            tbody.querySelectorAll('button[data-action="deleteDoc"]').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const idx = Number(this.dataset.idx);
                    const docs = await loadDocuments();
                    const documentToDelete = docs[idx];
                    if (!documentToDelete) return;
                    const docId = documentToDelete.id;
                    const nextDocs = docs.filter((_, docIdx) => docIdx !== idx);
                    const persisted = await saveDocuments(nextDocs);
                    if (!persisted) {
                        setDocumentUploadMessage('Could not remove the document from Supabase state.', true);
                        return;
                    }
                    // remove signed records for removed doc
                    const members = loadMembers();
                    members.forEach(m => { m.signedDocs = (m.signedDocs || []).filter(s => s.docId !== docId); });
                    saveMembers(members);
                    if (documentToDelete.storagePath) {
                        const removed = await deleteDocumentFileFromSupabase(documentToDelete.storagePath);
                        if (!removed) {
                            setDocumentUploadMessage('Document removed from the list, but the file could not be deleted from storage. Check console for details.', true);
                            return;
                        }
                    }
                    setDocumentUploadMessage('Document deleted.', false);
                });
            });
        }

        async function renderDocumentsList() {
            const tbody = document.getElementById('publicDocsTbody');
            if (!tbody) return;
            const docs = await loadDocuments();
            tbody.innerHTML = '';
            if (docs.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#777; padding:20px;">No documents available.</td></tr>'; return; }
            docs.forEach(d => {
                const tr = document.createElement('tr');
                const uploaded = new Date(d.uploadedAt).toLocaleDateString();
                const titleCell = document.createElement('td');
                titleCell.textContent = d.title || d.filename;
                const fileCell = document.createElement('td');
                const fileLink = document.createElement('a');
                fileLink.href = getDocumentUrl(d);
                fileLink.download = d.filename;
                fileLink.textContent = d.filename;
                fileCell.appendChild(fileLink);
                const uploadedCell = document.createElement('td');
                uploadedCell.textContent = uploaded;
                const actionCell = document.createElement('td');
                const downloadLink = document.createElement('a');
                downloadLink.href = getDocumentUrl(d);
                downloadLink.download = d.filename;
                downloadLink.className = 'doc-actions';
                downloadLink.textContent = 'Download';
                actionCell.appendChild(downloadLink);
                let signed = false;
                if (sessionStorage.getItem('memberLoggedIn') === 'true') {
                    const username = sessionStorage.getItem('memberUsername');
                    const isGuest = sessionStorage.getItem('memberIsGuest') === 'true';
                    if (isGuest) {
                        const button = document.createElement('button');
                        button.className = 'doc-actions secondary';
                        button.dataset.action = 'loginToSign';
                        button.type = 'button';
                        button.textContent = 'Register to sign';
                        actionCell.appendChild(document.createTextNode(' '));
                        actionCell.appendChild(button);
                    } else {
                        const m = loadMembers().find(u => u.username === username);
                        signed = !!(m && (m.signedDocs || []).some(s => s.docId === d.id));
                        if (signed) {
                            const signedLabel = document.createElement('span');
                            signedLabel.style.color = '#4caf50';
                            signedLabel.style.fontWeight = 'bold';
                            signedLabel.textContent = 'Signed';
                            actionCell.appendChild(document.createTextNode(' '));
                            actionCell.appendChild(signedLabel);
                        } else {
                            const signButton = document.createElement('button');
                            signButton.className = 'doc-actions';
                            signButton.dataset.docid = d.id;
                            signButton.dataset.action = 'sign';
                            signButton.type = 'button';
                            signButton.textContent = 'Sign';
                            actionCell.appendChild(document.createTextNode(' '));
                            actionCell.appendChild(signButton);
                        }
                    }
                } else {
                    const button = document.createElement('button');
                    button.className = 'doc-actions secondary';
                    button.dataset.docid = d.id;
                    button.dataset.action = 'loginToSign';
                    button.type = 'button';
                    button.textContent = 'Login to sign';
                    actionCell.appendChild(document.createTextNode(' '));
                    actionCell.appendChild(button);
                }
                tr.appendChild(titleCell);
                tr.appendChild(fileCell);
                tr.appendChild(uploadedCell);
                tr.appendChild(actionCell);
                tbody.appendChild(tr);
            });
            tbody.querySelectorAll('button[data-action="sign"]').forEach(btn => btn.addEventListener('click', e => openSignModal(e.currentTarget.dataset.docid)));
            tbody.querySelectorAll('button[data-action="loginToSign"]').forEach(btn => btn.addEventListener('click', showMemberModal));
        }

        async function openSignModal(docId) {
            const docs = await loadDocuments();
            const doc = docs.find(d => d.id === docId);
            if (!doc) return;
            document.getElementById('signModal').style.display = 'flex';
            document.getElementById('signModal').classList.remove('hidden');
            const iframe = document.getElementById('docPreviewFrame');
            const img = document.getElementById('docPreviewImg');
            const documentUrl = getDocumentUrl(doc);
            if (doc.mimeType && doc.mimeType.startsWith('image/')) { img.src = documentUrl; img.style.display = 'block'; iframe.style.display = 'none'; }
            else { iframe.src = documentUrl; iframe.style.display = 'block'; img.style.display = 'none'; }
            currentSigningDocId = docId;
            clearSignature();
            document.getElementById('signMsg').textContent = '';
        }

        function closeSignModal() {
            document.getElementById('signModal').style.display = 'none';
            currentSigningDocId = null;
        }

        // signature canvas helpers
        let currentSigningDocId = null;
        const sigCanvas = document.getElementById('signatureCanvas');
        const sigCtx = sigCanvas.getContext('2d');
        let drawing = false;
        function clearSignature() { sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height); document.getElementById('typedSignature').value = ''; }
        function isCanvasBlank(c) { const blank = document.createElement('canvas'); blank.width = c.width; blank.height = c.height; return c.toDataURL() === blank.toDataURL(); }

        function setupSignatureCanvas() {
            const rect = () => sigCanvas.getBoundingClientRect();
            function getPos(e) {
                const r = rect();
                if (e.touches && e.touches.length) e = e.touches[0];
                return { x: (e.clientX - r.left) * (sigCanvas.width / r.width), y: (e.clientY - r.top) * (sigCanvas.height / r.height) };
            }
            sigCanvas.addEventListener('pointerdown', (e) => { drawing = true; const p = getPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); e.preventDefault(); });
            sigCanvas.addEventListener('pointermove', (e) => { if (!drawing) return; const p = getPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.strokeStyle = '#000'; sigCtx.lineWidth = 2; sigCtx.lineCap = 'round'; sigCtx.stroke(); });
            ['pointerup','pointerleave'].forEach(evt => sigCanvas.addEventListener(evt, () => { drawing = false; }));
        }
        setupSignatureCanvas();

        // registration-signature canvas (used during account creation)
        const regCanvas = document.getElementById('regSignatureCanvas');
        const regCtx = regCanvas ? regCanvas.getContext('2d') : null;
        function setupRegSignatureCanvas() {
            if (!regCanvas) return;
            let regDrawing = false;
            const rectR = () => regCanvas.getBoundingClientRect();
            function getPosR(e) { const r = rectR(); if (e.touches && e.touches.length) e = e.touches[0]; return { x: (e.clientX - r.left) * (regCanvas.width / r.width), y: (e.clientY - r.top) * (regCanvas.height / r.height) }; }
            regCanvas.addEventListener('pointerdown', (e) => { regDrawing = true; const p = getPosR(e); regCtx.beginPath(); regCtx.moveTo(p.x, p.y); e.preventDefault(); });
            regCanvas.addEventListener('pointermove', (e) => { if (!regDrawing) return; const p = getPosR(e); regCtx.lineTo(p.x, p.y); regCtx.strokeStyle = '#000'; regCtx.lineWidth = 2; regCtx.lineCap = 'round'; regCtx.stroke(); });
            ['pointerup','pointerleave'].forEach(evt => regCanvas.addEventListener(evt, () => { regDrawing = false; }));
        }
        setupRegSignatureCanvas();
        document.getElementById('regClearSignatureBtn')?.addEventListener('click', function(){ if (regCtx) regCtx.clearRect(0,0,regCanvas.width, regCanvas.height); document.getElementById('regTypedSignature').value = ''; });

        document.getElementById('clearSignatureBtn').addEventListener('click', clearSignature);
        document.getElementById('closeSignModalBtn').addEventListener('click', closeSignModal);
        document.getElementById('saveSignatureBtn').addEventListener('click', async function() {
            const username = sessionStorage.getItem('memberUsername');
            if (!username) { showMemberModal(); return; }
            const members = loadMembers();
            const user = members.find(u => u.username === username);
            if (!user) return;
            const typed = document.getElementById('typedSignature').value.trim();
            let sigData = null;
            if (!isCanvasBlank(sigCanvas)) sigData = sigCanvas.toDataURL();
            else if (typed) {
                const tmp = document.createElement('canvas'); tmp.width = 600; tmp.height = 80; const tc = tmp.getContext('2d'); tc.fillStyle = '#000'; tc.font = '28px sans-serif'; tc.fillText(typed, 8, 50); sigData = tmp.toDataURL();
            } else { document.getElementById('signMsg').textContent = 'Please draw or type your name to sign.'; return; }
            user.signedDocs = user.signedDocs || [];
            user.signedDocs.push({ docId: currentSigningDocId, signature: sigData, signedAt: new Date().toISOString() });
            saveMembers(members);
            document.getElementById('signMsg').textContent = 'Document signed.';
            setTimeout(() => { closeSignModal(); renderDocumentsList(); renderDocsAdmin(); }, 900);
        });

        // admin upload handlers
        document.getElementById('docUploadBtn').addEventListener('click', () => document.getElementById('docUploadInput').click());
        document.getElementById('docUploadInput').addEventListener('change', async function(e) {
            const input = e.target;
            const file = input.files[0];
            if (!file) return;
            const titleInput = document.getElementById('docTitleInput');
            const title = titleInput.value.trim() || file.name;
            setDocumentUploadMessage('Uploading document...', false);

            if (isLocalPreviewMode()) {
                const reader = new FileReader();
                reader.onload = async function(ev) {
                    const docs = await loadDocuments();
                    docs.push({
                        id: generateDocumentId(),
                        title: title,
                        filename: file.name,
                        mimeType: file.type || '',
                        publicUrl: ev.target.result,
                        uploadedAt: new Date().toISOString()
                    });
                    await saveDocuments(docs);
                    input.value = '';
                    titleInput.value = '';
                    setDocumentUploadMessage('Document saved locally for preview mode.', false);
                };
                reader.readAsDataURL(file);
                return;
            }

            const docId = generateDocumentId();
            const uploadResult = await uploadDocumentFileToSupabase(file, docId);
            if (!uploadResult) {
                setDocumentUploadMessage('Document upload failed before metadata could be saved. Check console for Supabase details.', true);
                return;
            }

            const docs = await loadDocuments();
            docs.push({
                id: docId,
                title: title,
                filename: file.name,
                mimeType: file.type || '',
                storagePath: uploadResult.storagePath,
                publicUrl: uploadResult.url,
                uploadedAt: new Date().toISOString()
            });
            const persisted = await saveDocuments(docs);
            if (!persisted) {
                const removed = await deleteDocumentFileFromSupabase(uploadResult.storagePath);
                setDocumentUploadMessage(removed
                    ? 'Document metadata did not save to Supabase. Upload was rolled back.'
                    : 'Document metadata did not save to Supabase. The uploaded file may need manual cleanup from storage.', true);
                return;
            }

            input.value = '';
            titleInput.value = '';
            setDocumentUploadMessage('Document uploaded and saved to Supabase.', false);
        });

        // render lists on load
        renderDocsAdmin();
        renderDocumentsList();
        renderAdminPaymentRequests();

        // ---- Player Stats (Offensive / Defensive) ----
        const LEAGUE_STANDINGS_KEY = 'leagueStandings_v1';
        const LEAGUE_SCHEDULE_KEY = 'leagueSchedule_v1';
        const OFFENSIVE_STATS_KEY = 'offensivePlayerStats_v1';
        const DEFENSIVE_STATS_KEY = 'defensivePlayerStats_v1';
        const RECAP_OFFENSIVE_STATS_KEY = 'recapOffensivePlayerStats_v1';
        const RECAP_DEFENSIVE_STATS_KEY = 'recapDefensivePlayerStats_v1';
        const STATS_TEAM_LOGOS_KEY = 'statsTeamLogos_v1';
        const STATS_TEAM_LOGO_MAX_WIDTH = 200;
        const STATS_TEAM_LOGO_MAX_HEIGHT = 200;
        const STATS_TEAM_LOGO_QUALITY = 0.8;
        const CURRENT_SEASON_LABEL_KEY = 'currentSeasonLabel_v1';
        const RECAP_SEASON_LABEL_KEY = 'recapSeasonLabel_v1';
        const SEASON_ARCHIVES_KEY = 'seasonArchives_v1';
        const SELECTED_SEASON_ARCHIVE_KEY = 'selectedSeasonArchive_v1';
        const leagueStandingsFields = [
            { key: 'team', placeholder: 'Team name' },
            { key: 'wins', placeholder: '0' },
            { key: 'losses', placeholder: '0' },
            { key: 'pointsScored', placeholder: '0' },
            { key: 'pointsAgainst', placeholder: '0' }
        ];
        const leagueScheduleFields = [
            { key: 'week', placeholder: 'Week 1' },
            { key: 'date', placeholder: 'MM/DD/YYYY' },
            { key: 'time', placeholder: '7:00 PM' },
            { key: 'homeTeam', placeholder: 'Team 1 name' },
            { key: 'homeLogo', placeholder: '' },
            { key: 'awayTeam', placeholder: 'Team 2 name' },
            { key: 'awayLogo', placeholder: '' },
            { key: 'location', placeholder: 'Field name' },
            { key: 'status', placeholder: '0-0' }
        ];
        const defaultLeagueStandings = [
            {
                team: '865 ELITE FLAG FOOTBALL',
                wins: '0',
                losses: '0',
                pointsScored: '0',
                pointsAgainst: '0'
            }
        ];
        const defaultLeagueSchedule = [
            {
                week: 'Week 1',
                date: 'TBD',
                time: 'TBD',
                homeTeam: '865 ELITE FLAG FOOTBALL',
                homeLogo: '',
                awayTeam: 'TBD',
                awayLogo: '',
                location: 'TBD',
                status: '0-0'
            }
        ];
        const offensiveCols = ['Team','Player Name','Player Position','Passing TD','Passing Yards','INT\'s','Rushing Yards','Rushing Touchdowns','Recieving Yards','Recieving Touchdowns','Receptions'];
        const defensiveCols = ['Team','Player Name','Player Position','Tackles','Sacks','Interceptions','Pass Break Ups','Defensive TDs'];
        const statsSortState = {
            offensive: { column: 3, direction: 'desc' },
            defensive: { column: 3, direction: 'desc' },
            recapOffensive: { column: 3, direction: 'desc' },
            recapDefensive: { column: 3, direction: 'desc' }
        };

        function getDefaultStatsSortConfig(type) {
            if (type === 'defensive' || type === 'recapDefensive') {
                return { column: 3, direction: 'desc' };
            }
            return { column: 3, direction: 'desc' };
        }

        function getStatsSortSelectValue(type, column) {
            var config = getStatsSortConfig(type);
            return config.column === column ? config.direction : '';
        }

        function normalizeStatsRow(row, cols) {
            return cols.map(function(_, index) {
                return row && row[index] !== undefined ? row[index] : '';
            });
        }

        function normalizeTeamNameKey(name) {
            return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
        }

        function loadStatsTeamLogos() {
            try {
                var saved = JSON.parse(localStorage.getItem(STATS_TEAM_LOGOS_KEY) || '{}');
                if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
                return Object.keys(saved).reduce(function(acc, key) {
                    if (typeof key !== 'string') return acc;
                    var normalizedKey = normalizeTeamNameKey(key);
                    var value = saved[key];
                    if (!normalizedKey || typeof value !== 'string') return acc;
                    acc[normalizedKey] = value;
                    return acc;
                }, {});
            } catch (e) {
                return {};
            }
        }

        function saveStatsTeamLogos(logos) {
            localStorage.setItem(STATS_TEAM_LOGOS_KEY, JSON.stringify(logos || {}));
            queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.statsTeamLogos, logos || {}, 'StatsTeamLogos');
        }

        function getStatsTeamLogo(teamName) {
            var key = normalizeTeamNameKey(teamName);
            if (!key) return '';
            var logos = loadStatsTeamLogos();
            return String(logos[key] || '');
        }

        function setStatsTeamLogo(teamName, logoDataUrl) {
            var key = normalizeTeamNameKey(teamName);
            if (!key) return;
            var logos = loadStatsTeamLogos();
            logos[key] = String(logoDataUrl || '');
            saveStatsTeamLogos(logos);
        }

        function renderStatsTeamCell(teamName) {
            var safeName = escapeHtml(teamName || '\u2014');
            var logo = getStatsTeamLogo(teamName);
            var initials = escapeHtml(getScheduleTeamInitials(teamName || 'TBD'));
            var logoMarkup = logo
                ? '<img class="stats-team-logo" src="' + escapeHtml(logo) + '" alt="' + safeName + ' logo">'
                : '<div class="stats-team-logo-placeholder">' + initials + '</div>';
            return '<div class="stats-team-cell">' + logoMarkup + '<span>' + safeName + '</span></div>';
        }

        function buildStatsTeamAdminEditor(statsKey, rowIndex, teamName) {
            var safeName = escapeHtml(teamName || '');
            var currentLogo = getStatsTeamLogo(teamName);
            var previewMarkup = currentLogo
                ? '<img class="stats-team-logo" src="' + escapeHtml(currentLogo) + '" alt="' + (safeName || 'Team') + ' logo preview">'
                : '<div class="stats-team-logo-placeholder">' + escapeHtml(getScheduleTeamInitials(teamName || 'TBD')) + '</div>';
            return '<div class="stats-team-admin-editor">' +
                '<input type="text" value="' + safeName + '" data-statskey="' + statsKey + '" data-row="' + rowIndex + '" data-col="0" style="width:100%;text-align:center;border:1px solid #ddd;padding:4px;" placeholder="Team name">' +
                '<div class="stats-team-admin-preview">' + previewMarkup + '<span style="font-size:0.75rem;color:#bbb;">Logo</span></div>' +
                '<input type="file" accept="image/*" aria-label="Upload team logo" class="stats-team-admin-upload stats-team-logo-upload" data-statskey="' + statsKey + '" data-row="' + rowIndex + '">' +
            '</div>';
        }

        function handleStatsFilterInput(btn) {
            if (!btn) return;
            var type = btn.getAttribute('data-stats-filter-type');
            var column = btn.getAttribute('data-stats-filter-col');
            if (!type || column == null || !statsSortState[type]) return;
            var selectedDirection = btn.getAttribute('data-dir') || '';
            var numericColumn = Number(column);

            if (selectedDirection === 'asc' || selectedDirection === 'desc') {
                if (statsSortState[type].column === numericColumn && statsSortState[type].direction === selectedDirection) {
                    statsSortState[type] = getDefaultStatsSortConfig(type);
                } else {
                    statsSortState[type].column = numericColumn;
                    statsSortState[type].direction = selectedDirection;
                }
            } else {
                statsSortState[type] = getDefaultStatsSortConfig(type);
            }

            renderAllStats();
        }

        function ensureStatsFilterRow(tableId, cols, type) {
            var table = document.getElementById(tableId);
            var thead = table ? table.querySelector('thead') : null;
            if (!thead) return;

            var headerRow = thead.querySelector('tr');
            if (!headerRow) return;
            headerRow.classList.add('stats-column-row');

            var filterRow = thead.querySelector('.stats-filter-row');
            if (!filterRow) {
                filterRow = document.createElement('tr');
                filterRow.className = 'stats-filter-row';
                thead.appendChild(filterRow);
            }

            var headerCount = headerRow.querySelectorAll('th').length;
            var sortableColumns = type === 'offensive' || type === 'recapOffensive'
                ? [2, 3, 4, 5, 6, 7, 8, 9, 10]
                : [2, 3, 4, 5, 6, 7];
            var html = '';
            for (var index = 0; index < headerCount; index += 1) {
                if (index >= cols.length || sortableColumns.indexOf(index) === -1) {
                    html += '<th class="stats-filter-spacer"></th>';
                    continue;
                }
                var activeDir = getStatsSortSelectValue(type, index);
                var descActive = activeDir === 'desc' ? ' active' : '';
                var ascActive  = activeDir === 'asc'  ? ' active' : '';
                var colName = escapeHtml(cols[index]);
                html += '<th><div class="stat-sort-btns">' +
                    '<button class="stat-sort-btn' + descActive + '" data-stats-filter-type="' + escapeHtml(type) + '" data-stats-filter-col="' + index + '" data-dir="desc" title="Sort ' + colName + ' high to low. Click again to clear sort." aria-label="Sort ' + colName + ' high to low" onclick="handleStatsFilterInput(this)">↓ H</button>' +
                    '<button class="stat-sort-btn' + ascActive  + '" data-stats-filter-type="' + escapeHtml(type) + '" data-stats-filter-col="' + index + '" data-dir="asc"  title="Sort ' + colName + ' low to high. Click again to clear sort." aria-label="Sort ' + colName + ' low to high"  onclick="handleStatsFilterInput(this)">↑ L</button>' +
                    '</div></th>';
            }
            filterRow.innerHTML = html;
        }

        function ensureAllStatsFilterUI() {
            ensureStatsFilterRow('offensiveStatsTable', offensiveCols, 'offensive');
            ensureStatsFilterRow('defensiveStatsTable', defensiveCols, 'defensive');
            ensureStatsFilterRow('recapOffensiveStatsTable', offensiveCols, 'recapOffensive');
            ensureStatsFilterRow('recapDefensiveStatsTable', defensiveCols, 'recapDefensive');
        }

        function getDefaultSeasonLabel(offset) {
            return String(new Date().getFullYear() + (offset || 0)) + ' Season';
        }

        function getNextSeasonLabel(label) {
            var text = String(label || '').trim();
            var match = text.match(/(19|20)\d{2}/);
            if (!match) return getDefaultSeasonLabel(1);
            var nextYear = String(Number(match[0]) + 1);
            return text.replace(match[0], nextYear);
        }

        function loadSeasonLabel(key, fallback) {
            try {
                return (localStorage.getItem(key) || fallback || '').trim() || fallback;
            } catch (err) {
                return fallback;
            }
        }

        function saveSeasonLabel(key, value) {
            var normalizedValue = String(value || '').trim();
            localStorage.setItem(key, normalizedValue);
            var remoteKey = key === CURRENT_SEASON_LABEL_KEY
                ? SUPABASE_PUBLIC_STATE_KEYS.currentSeasonLabel
                : SUPABASE_PUBLIC_STATE_KEYS.recapSeasonLabel;
            queueSharedPublicStatePersist(remoteKey, normalizedValue, 'SeasonLabels');
        }

        function loadSeasonArchives() {
            try {
                var parsed = JSON.parse(localStorage.getItem(SEASON_ARCHIVES_KEY) || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch (err) {
                return [];
            }
        }

        function saveSeasonArchives(items) {
            localStorage.setItem(SEASON_ARCHIVES_KEY, JSON.stringify(items || []));
            queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.seasonArchives, items || [], 'SeasonArchives');
        }

        function getSelectedSeasonArchiveId() {
            return localStorage.getItem(SELECTED_SEASON_ARCHIVE_KEY) || '';
        }

        function setSelectedSeasonArchiveId(id) {
            if (id) localStorage.setItem(SELECTED_SEASON_ARCHIVE_KEY, id);
            else localStorage.removeItem(SELECTED_SEASON_ARCHIVE_KEY);
            queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.selectedSeasonArchiveId, id || '', 'SeasonArchives');
        }

        function migrateLegacyRecapArchive() {
            var archives = loadSeasonArchives();
            if (archives.length) return archives;

            var legacyOffensive = loadPlayerStats(RECAP_OFFENSIVE_STATS_KEY) || [];
            var legacyDefensive = loadPlayerStats(RECAP_DEFENSIVE_STATS_KEY) || [];
            var legacyLabel = loadSeasonLabel(RECAP_SEASON_LABEL_KEY, '').trim();
            if (!legacyLabel && !legacyOffensive.length && !legacyDefensive.length) {
                return archives;
            }

            var legacyArchive = {
                id: 'archive-' + Date.now(),
                label: legacyLabel || 'Archived Season',
                archivedAt: new Date().toISOString(),
                offensive: legacyOffensive,
                defensive: legacyDefensive
            };
            archives = [legacyArchive];
            saveSeasonArchives(archives);
            setSelectedSeasonArchiveId(legacyArchive.id);
            return archives;
        }

        function getSelectedSeasonArchive() {
            var archives = migrateLegacyRecapArchive();
            if (!archives.length) return null;
            var selectedId = getSelectedSeasonArchiveId();
            var selected = archives.find(function(item) { return item.id === selectedId; }) || archives[0];
            if (selected && selected.id !== selectedId) setSelectedSeasonArchiveId(selected.id);
            return selected || null;
        }

        function renderSeasonLabels() {
            var currentLabel = loadSeasonLabel(CURRENT_SEASON_LABEL_KEY, getDefaultSeasonLabel(0));
            var selectedArchive = getSelectedSeasonArchive();
            var recapLabel = selectedArchive ? selectedArchive.label : 'Previous Season Not Archived Yet';
            var currentDisplay = document.getElementById('currentSeasonLabelDisplay');
            var recapDisplay = document.getElementById('seasonRecapLabelDisplay');
            var currentInput = document.getElementById('currentSeasonLabelInput');
            if (currentDisplay) currentDisplay.textContent = currentLabel;
            if (recapDisplay) recapDisplay.textContent = recapLabel;
            if (currentInput) currentInput.value = currentLabel;
        }

        function formatArchiveUpdatedAt(value) {
            if (!value) return 'Archive has not been updated yet.';
            var date = new Date(value);
            if (Number.isNaN(date.getTime())) return 'Archive has not been updated yet.';
            return 'Last updated: ' + date.toLocaleString();
        }

        function bindSeasonRecapSelect() {
            var select = document.getElementById('seasonRecapSelect');
            if (!select || select.dataset.bound === 'true') return;
            select.dataset.bound = 'true';
            select.addEventListener('change', function() {
                setSelectedSeasonArchiveId(this.value);
                renderSeasonLabels();
                renderSeasonRecapStats();
            });
        }

        function renderSeasonArchiveSelect() {
            var select = document.getElementById('seasonRecapSelect');
            var note = document.getElementById('seasonRecapUpdatedNote');
            if (!select) return;
            var archives = migrateLegacyRecapArchive();
            var selectedArchive = getSelectedSeasonArchive();

            if (!archives.length) {
                select.innerHTML = '<option value="">No archived seasons yet</option>';
                select.disabled = true;
                if (note) note.textContent = 'Archive has not been updated yet.';
                return;
            }

            select.disabled = false;
            select.innerHTML = archives.map(function(item) {
                return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.label) + '</option>';
            }).join('');
            if (selectedArchive) select.value = selectedArchive.id;
            if (note) note.textContent = formatArchiveUpdatedAt(selectedArchive && selectedArchive.archivedAt);
        }

        function escapeHtml(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function cloneRows(rows) {
            return rows.map(function(row) {
                return Object.assign({}, row);
            });
        }

        function blankLeagueRow(fields) {
            var row = {};
            fields.forEach(function(field) {
                row[field.key] = '';
            });
            return row;
        }

        function getScheduleTeamInitials(name) {
            var words = String(name || '').trim().split(/\s+/).filter(Boolean);
            if (!words.length) return 'TBD';
            return words.slice(0, 2).map(function(word) {
                return word.charAt(0).toUpperCase();
            }).join('');
        }

        function normalizeScheduleResultText(value) {
            var text = String(value || '').trim();
            if (!text || /^upcoming$/i.test(text)) return '0-0';
            return text;
        }

        function parseLegacyMatchup(matchup) {
            var text = String(matchup || '').trim();
            if (!text) return { homeTeam: '', awayTeam: '' };
            var parts = text.split(/\s+vs\.?\s+/i);
            if (parts.length < 2) {
                return { homeTeam: text, awayTeam: '' };
            }
            return {
                homeTeam: (parts.shift() || '').trim(),
                awayTeam: parts.join(' vs ').trim()
            };
        }

        function normalizeLeagueScheduleRow(row) {
            var source = row || {};
            var legacyTeams = parseLegacyMatchup(source.matchup);
            return {
                week: String(source.week || '').trim(),
                date: String(source.date || '').trim(),
                time: String(source.time || '').trim(),
                homeTeam: String(source.homeTeam || legacyTeams.homeTeam || '').trim(),
                homeLogo: String(source.homeLogo || '').trim(),
                awayTeam: String(source.awayTeam || legacyTeams.awayTeam || '').trim(),
                awayLogo: String(source.awayLogo || '').trim(),
                location: String(source.location || '').trim(),
                status: normalizeScheduleResultText(source.status)
            };
        }

        function getScheduleResultOutcome(text) {
            var result = parseScheduleResultText(normalizeScheduleResultText(text));
            var left = Number(result.leftScore);
            var right = Number(result.rightScore);
            if (!result.hasPair || Number.isNaN(left) || Number.isNaN(right) || left === right) {
                return { home: '', away: '' };
            }
            return left > right ? { home: 'win', away: 'loss' } : { home: 'loss', away: 'win' };
        }

        function renderScheduleTeamMarkup(name, logo, sideClass, outcome) {
            var teamName = name || 'TBD';
            var safeName = escapeHtml(teamName);
            var safeLogo = escapeHtml(logo || '');
            var badgeMarkup = outcome === 'win'
                ? '<div class="schedule-team-badge win">W</div>'
                : outcome === 'loss'
                    ? '<div class="schedule-team-badge loss">L</div>'
                    : '';
            var logoMarkup = logo
                ? '<img class="schedule-team-logo" src="' + safeLogo + '" alt="' + safeName + ' logo">'
                : '<div class="schedule-team-logo schedule-team-logo-placeholder">' + escapeHtml(getScheduleTeamInitials(teamName)) + '</div>';

            return '<div class="schedule-team ' + sideClass + '">' +
                badgeMarkup +
                logoMarkup +
                '<div class="schedule-team-name">' + safeName + '</div>' +
            '</div>';
        }

        function renderScheduleMatchupMarkup(row) {
            var outcome = getScheduleResultOutcome(row.status);
            return '<div class="schedule-matchup" data-home-logo="' + escapeHtml(row.homeLogo || '') + '" data-away-logo="' + escapeHtml(row.awayLogo || '') + '">' +
                renderScheduleTeamMarkup(row.homeTeam, row.homeLogo, 'schedule-team-home', outcome.home) +
                '<div class="schedule-versus">VS</div>' +
                renderScheduleTeamMarkup(row.awayTeam, row.awayLogo, 'schedule-team-away', outcome.away) +
            '</div>';
        }

        function parseScheduleResultText(text) {
            var value = normalizeScheduleResultText(text);
            var match = value.match(/^(.+?)\s*-\s*(.+)$/);
            if (!match) {
                return {
                    leftScore: value || '\u2014',
                    rightScore: '\u2014',
                    hasPair: false
                };
            }
            return {
                leftScore: match[1].trim() || '\u2014',
                rightScore: match[2].trim() || '\u2014',
                hasPair: true
            };
        }

        function getScheduleAdminScoreParts(text) {
            var parsed = parseScheduleResultText(text);
            var left = String(parsed.leftScore || '0').trim();
            var right = String(parsed.rightScore || '0').trim();
            return {
                left: /^\d+$/.test(left) ? left : '0',
                right: /^\d+$/.test(right) ? right : '0'
            };
        }

        function syncScheduleScoreInputs(input) {
            var row = input ? input.closest('tr') : null;
            if (!row) return;
            var leftInput = row.querySelector('input[data-score-part="left"]');
            var rightInput = row.querySelector('input[data-score-part="right"]');
            var hiddenInput = row.querySelector('input[data-key="status"]');
            if (!leftInput || !rightInput || !hiddenInput) return;
            var left = String(leftInput.value || '0').replace(/[^0-9]/g, '') || '0';
            var right = String(rightInput.value || '0').replace(/[^0-9]/g, '') || '0';
            leftInput.value = left;
            rightInput.value = right;
            hiddenInput.value = left + '-' + right;
        }

        function renderScheduleResultMarkup(row) {
            var result = parseScheduleResultText(row.status);
            return '<div class="schedule-result">' +
                '<div class="schedule-result-scoreboard">' +
                    '<div class="schedule-result-score">' + escapeHtml(result.leftScore) + '</div>' +
                    '<div class="schedule-result-separator">-</div>' +
                    '<div class="schedule-result-score">' + escapeHtml(result.rightScore) + '</div>' +
                '</div>' +
                '<div class="schedule-result-teams">' +
                    '<div class="schedule-result-team">' + escapeHtml(row.homeTeam || 'TBD') + '</div>' +
                    '<div class="schedule-result-team">' + escapeHtml(row.awayTeam || 'TBD') + '</div>' +
                '</div>' +
            '</div>';
        }

        function loadLeagueCollection(key, defaults) {
            try {
                const raw = localStorage.getItem(key);
                if (raw === null) return cloneRows(defaults);
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : cloneRows(defaults);
            } catch (e) {
                return cloneRows(defaults);
            }
        }

        function saveLeagueCollection(key, rows) {
            localStorage.setItem(key, JSON.stringify(rows));
            var remoteKey = key === LEAGUE_STANDINGS_KEY
                ? SUPABASE_PUBLIC_STATE_KEYS.leagueStandings
                : SUPABASE_PUBLIC_STATE_KEYS.leagueSchedule;
            queueSharedPublicStatePersist(remoteKey, rows, key === LEAGUE_STANDINGS_KEY ? 'Standings' : 'Schedule');
        }

        function loadLeagueStandings() {
            return loadLeagueCollection(LEAGUE_STANDINGS_KEY, defaultLeagueStandings);
        }

        function saveLeagueStandings(rows) {
            saveLeagueCollection(LEAGUE_STANDINGS_KEY, rows);
        }

        function loadLeagueSchedule() {
            return loadLeagueCollection(LEAGUE_SCHEDULE_KEY, defaultLeagueSchedule).map(normalizeLeagueScheduleRow);
        }

        function saveLeagueSchedule(rows) {
            saveLeagueCollection(LEAGUE_SCHEDULE_KEY, rows.map(normalizeLeagueScheduleRow));
        }

        function syncLeagueStandingsFromPublicTable() {
            const tbody = document.getElementById('leagueStandingsBody');
            if (!tbody) return;
            const rows = Array.from(tbody.querySelectorAll('tr')).map(function(tr) {
                const cells = Array.from(tr.querySelectorAll('td')).map(function(td) {
                    return td.innerText.trim();
                });
                const firstCell = tr.querySelector('td:first-child');
                const hasLogoColumn = !!(firstCell && firstCell.querySelector('.standings-logo-cell, .stats-team-logo, .stats-team-logo-placeholder, img'));
                const offset = hasLogoColumn ? 1 : 0;
                if (cells.length < (5 + offset)) return null;
                return {
                    team: cells[0 + offset] || '',
                    wins: cells[1 + offset] || '',
                    losses: cells[2 + offset] || '',
                    pointsScored: cells[3 + offset] || '',
                    pointsAgainst: cells[4 + offset] || ''
                };
            }).filter(function(row) {
                return row && Object.keys(row).some(function(key) { return row[key]; });
            });
            saveLeagueStandings(rows);
            renderLeagueAdminTable('leagueStandingsAdminBody', leagueStandingsFields, rows, 'standings');
        }

        function renderStandingsTeamLogo(teamName) {
            var safeName = escapeHtml(teamName || 'Team');
            var logo = getStatsTeamLogo(teamName);
            if (logo) {
                return '<img class="stats-team-logo" src="' + escapeHtml(logo) + '" alt="' + safeName + ' logo">';
            }
            return '<div class="stats-team-logo-placeholder">' + escapeHtml(getScheduleTeamInitials(teamName || 'TBD')) + '</div>';
        }

        function buildStandingsTeamAdminEditor(teamName) {
            var safeName = escapeHtml(teamName || '');
            var previewMarkup = teamName
                ? renderStandingsTeamLogo(teamName)
                : '<div class="stats-team-logo-placeholder">--</div>';
            return '<div class="standings-admin-team-editor">' +
                '<input type="text" data-key="team" value="' + safeName + '" placeholder="Team name">' +
                '<div class="standings-admin-logo-controls">' +
                    '<div class="standings-admin-logo-preview">' + previewMarkup + '</div>' +
                    '<input type="file" accept="image/*" aria-label="Upload team logo" class="standings-admin-logo-upload">' +
                '</div>' +
            '</div>';
        }

        function syncLeagueScheduleFromPublicTable() {
            const tbody = document.getElementById('leagueScheduleBody');
            if (!tbody) return;
            const rows = Array.from(tbody.querySelectorAll('tr')).map(function(tr) {
                const cells = Array.from(tr.querySelectorAll('td'));
                if (cells.length < 6) return null;
                const matchup = cells[3].querySelector('.schedule-matchup');
                const resultScore = cells[5].querySelector('.schedule-result-score');
                const legacyMatchup = parseLegacyMatchup(cells[3].innerText.replace(/\s+/g, ' ').trim());
                const homeTeamName = matchup ? matchup.querySelector('.schedule-team-home .schedule-team-name') : null;
                const awayTeamName = matchup ? matchup.querySelector('.schedule-team-away .schedule-team-name') : null;
                return {
                    week: cells[0].innerText.trim() || '',
                    date: cells[1].innerText.trim() || '',
                    time: cells[2].innerText.trim() || '',
                    homeTeam: homeTeamName ? homeTeamName.innerText.trim() : legacyMatchup.homeTeam,
                    homeLogo: matchup ? (matchup.dataset.homeLogo || '') : '',
                    awayTeam: awayTeamName ? awayTeamName.innerText.trim() : legacyMatchup.awayTeam,
                    awayLogo: matchup ? (matchup.dataset.awayLogo || '') : '',
                    location: cells[4].innerText.trim() || '',
                    status: normalizeScheduleResultText(resultScore ? resultScore.innerText.trim() : cells[5].innerText.trim() || '')
                };
            }).filter(function(row) {
                return row && Object.keys(row).some(function(key) { return row[key]; });
            });
            saveLeagueSchedule(rows);
            renderLeagueScheduleAdminTable(rows);
        }

        function renderLeagueStandingsPublic() {
            const tbody = document.getElementById('leagueStandingsBody');
            if (!tbody) return;
            const rows = loadLeagueStandings();
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#aaa;">Standings will be posted soon.</td></tr>';
                return;
            }
            tbody.innerHTML = rows.map(function(row) {
                return '<tr>' +
                    '<td><div class="standings-logo-cell">' + renderStandingsTeamLogo(row.team || '') + '</div></td>' +
                    '<td>' + escapeHtml(row.team || '\u2014') + '</td>' +
                    '<td>' + escapeHtml(row.wins || '0') + '</td>' +
                    '<td>' + escapeHtml(row.losses || '0') + '</td>' +
                    '<td>' + escapeHtml(row.pointsScored || '0') + '</td>' +
                    '<td>' + escapeHtml(row.pointsAgainst || '0') + '</td>' +
                '</tr>';
            }).join('');
        }

        function renderLeagueSchedulePublic() {
            const tbody = document.getElementById('leagueScheduleBody');
            if (!tbody) return;
            const rows = loadLeagueSchedule();
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#aaa;">Schedule will be posted soon.</td></tr>';
                return;
            }
            tbody.innerHTML = rows.map(function(row) {
                return '<tr>' +
                    '<td>' + escapeHtml(row.week || '\u2014') + '</td>' +
                    '<td>' + escapeHtml(row.date || '\u2014') + '</td>' +
                    '<td>' + escapeHtml(row.time || '\u2014') + '</td>' +
                    '<td>' + renderScheduleMatchupMarkup(row) + '</td>' +
                    '<td>' + escapeHtml(row.location || '\u2014') + '</td>' +
                    '<td>' + renderScheduleResultMarkup(row) + '</td>' +
                '</tr>';
            }).join('');
        }

        function renderLeagueAdminTable(bodyId, fields, rows, type) {
            const tbody = document.getElementById(bodyId);
            if (!tbody) return;
            const editableRows = rows.length ? rows : [blankLeagueRow(fields)];
            let html = '';
            editableRows.forEach(function(row, rowIdx) {
                html += '<tr>';
                fields.forEach(function(field) {
                    if (type === 'standings' && field.key === 'team') {
                        html += '<td>' + buildStandingsTeamAdminEditor(row[field.key] || '') + '</td>';
                    } else {
                        html += '<td><input type="text" data-key="' + field.key + '" value="' + escapeHtml(row[field.key] || '') + '" placeholder="' + escapeHtml(field.placeholder) + '"></td>';
                    }
                });
                html += '<td><button type="button" class="cta-button small" style="background:#c62828;" onclick="removeLeagueAdminRow(\'' + type + '\',' + rowIdx + ')">Remove</button></td>';
                html += '</tr>';
            });
            tbody.innerHTML = html;
        }

        function renderLeagueScheduleAdminTable(rows) {
            const tbody = document.getElementById('leagueScheduleAdminBody');
            if (!tbody) return;
            const editableRows = rows.length ? rows : [blankLeagueRow(leagueScheduleFields)];
            let html = '';

            editableRows.map(normalizeLeagueScheduleRow).forEach(function(row, rowIdx) {
                var scoreParts = getScheduleAdminScoreParts(row.status);
                html += '<tr>' +
                    '<td><input type="text" data-key="week" value="' + escapeHtml(row.week || '') + '" placeholder="Week 1"></td>' +
                    '<td><input type="text" data-key="date" value="' + escapeHtml(row.date || '') + '" placeholder="MM/DD/YYYY"></td>' +
                    '<td><input type="text" data-key="time" value="' + escapeHtml(row.time || '') + '" placeholder="7:00 PM"></td>' +
                    '<td>' +
                        '<div class="schedule-admin-matchup">' +
                            '<div class="schedule-admin-team-block">' +
                                '<label>Team 1 Name</label>' +
                                '<input type="text" data-key="homeTeam" value="' + escapeHtml(row.homeTeam || '') + '" placeholder="Team 1 name">' +
                                '<label>Team 1 Logo</label>' +
                                '<img class="schedule-admin-logo-preview' + (row.homeLogo ? '' : ' hidden') + '" src="' + escapeHtml(row.homeLogo || '') + '" alt="Team 1 logo preview">' +
                                '<div class="schedule-admin-logo-empty"' + (row.homeLogo ? ' style="display:none;"' : '') + '>No logo selected</div>' +
                                '<input type="hidden" data-key="homeLogo" value="' + escapeHtml(row.homeLogo || '') + '">' +
                                '<input type="file" accept="image/*" class="schedule-admin-logo-upload" data-key="homeLogo">' +
                            '</div>' +
                            '<div class="schedule-admin-team-block">' +
                                '<label>Team 2 Name</label>' +
                                '<input type="text" data-key="awayTeam" value="' + escapeHtml(row.awayTeam || '') + '" placeholder="Team 2 name">' +
                                '<label>Team 2 Logo</label>' +
                                '<img class="schedule-admin-logo-preview' + (row.awayLogo ? '' : ' hidden') + '" src="' + escapeHtml(row.awayLogo || '') + '" alt="Team 2 logo preview">' +
                                '<div class="schedule-admin-logo-empty"' + (row.awayLogo ? ' style="display:none;"' : '') + '>No logo selected</div>' +
                                '<input type="hidden" data-key="awayLogo" value="' + escapeHtml(row.awayLogo || '') + '">' +
                                '<input type="file" accept="image/*" class="schedule-admin-logo-upload" data-key="awayLogo">' +
                            '</div>' +
                        '</div>' +
                    '</td>' +
                    '<td><input type="text" data-key="location" value="' + escapeHtml(row.location || '') + '" placeholder="Field name"></td>' +
                    '<td>' +
                        '<div class="schedule-score-editor">' +
                            '<input type="number" min="0" step="1" data-score-part="left" value="' + escapeHtml(scoreParts.left) + '" oninput="syncScheduleScoreInputs(this)">' +
                            '<span>-</span>' +
                            '<input type="number" min="0" step="1" data-score-part="right" value="' + escapeHtml(scoreParts.right) + '" oninput="syncScheduleScoreInputs(this)">' +
                            '<input type="hidden" data-key="status" value="' + escapeHtml(normalizeScheduleResultText(row.status || '0-0')) + '">' +
                        '</div>' +
                    '</td>' +
                    '<td><button type="button" class="cta-button small" style="background:#c62828;" onclick="removeLeagueAdminRow(\'schedule\',' + rowIdx + ')">Remove</button></td>' +
                '</tr>';
            });

            tbody.innerHTML = html;
        }

        function renderLeagueAdminTables() {
            renderLeagueStandingsPublic();
            renderLeagueSchedulePublic();
            renderLeagueAdminTable('leagueStandingsAdminBody', leagueStandingsFields, loadLeagueStandings(), 'standings');
            renderLeagueScheduleAdminTable(loadLeagueSchedule());
        }

        function collectLeagueAdminRows(bodyId, fields) {
            const tbody = document.getElementById(bodyId);
            if (!tbody) return [];
            return Array.from(tbody.querySelectorAll('tr')).map(function(row) {
                const item = {};
                fields.forEach(function(field) {
                    const input = row.querySelector('input[data-key="' + field.key + '"]');
                    item[field.key] = input ? input.value.trim() : '';
                });
                return item;
            }).filter(function(row) {
                return fields.some(function(field) {
                    return row[field.key];
                });
            });
        }

        function showLeagueAdminMessage(id, text, color) {
            const msg = document.getElementById(id);
            if (!msg) return;
            msg.style.color = color;
            msg.textContent = text;
            setTimeout(function() {
                if (msg.textContent === text) msg.textContent = '';
            }, 3000);
        }

        function addLeagueAdminRow(type) {
            if (!isAdminLoggedIn()) return;
            if (type === 'standings') {
                const rows = loadLeagueStandings();
                rows.push(blankLeagueRow(leagueStandingsFields));
                renderLeagueAdminTable('leagueStandingsAdminBody', leagueStandingsFields, rows, 'standings');
                return;
            }
            const rows = loadLeagueSchedule();
            rows.push(blankLeagueRow(leagueScheduleFields));
            renderLeagueScheduleAdminTable(rows);
        }

        function removeLeagueAdminRow(type, rowIdx) {
            if (!isAdminLoggedIn()) return;
            if (type === 'standings') {
                const rows = collectLeagueAdminRows('leagueStandingsAdminBody', leagueStandingsFields);
                rows.splice(rowIdx, 1);
                renderLeagueAdminTable('leagueStandingsAdminBody', leagueStandingsFields, rows, 'standings');
                return;
            }
            const rows = collectLeagueAdminRows('leagueScheduleAdminBody', leagueScheduleFields);
            rows.splice(rowIdx, 1);
            renderLeagueScheduleAdminTable(rows);
        }

        function saveStandingsFromAdminForm() {
            if (!isAdminLoggedIn()) return;
            if (!document.getElementById('leagueStandingsAdminBody')) return;
            const rows = collectLeagueAdminRows('leagueStandingsAdminBody', leagueStandingsFields);
            saveLeagueStandings(rows);
            renderLeagueAdminTables();
            showLeagueAdminMessage('leagueStandingsAdminMsg', 'Standings saved successfully.', 'green');
        }

        function saveScheduleFromAdminForm() {
            if (!isAdminLoggedIn()) return;
            const rows = collectLeagueAdminRows('leagueScheduleAdminBody', leagueScheduleFields);
            saveLeagueSchedule(rows);
            renderLeagueAdminTables();
            showLeagueAdminMessage('leagueScheduleAdminMsg', 'Schedule saved successfully.', 'green');
        }

        function loadPlayerStats(key) {
            try { return JSON.parse(localStorage.getItem(key)) || null; } catch(e) { return null; }
        }
        function savePlayerStats(key, data) {
            localStorage.setItem(key, JSON.stringify(data));
            var remoteMap = {};
            remoteMap[OFFENSIVE_STATS_KEY] = SUPABASE_PUBLIC_STATE_KEYS.offensiveStats;
            remoteMap[DEFENSIVE_STATS_KEY] = SUPABASE_PUBLIC_STATE_KEYS.defensiveStats;
            remoteMap[RECAP_OFFENSIVE_STATS_KEY] = SUPABASE_PUBLIC_STATE_KEYS.recapOffensiveStats;
            remoteMap[RECAP_DEFENSIVE_STATS_KEY] = SUPABASE_PUBLIC_STATE_KEYS.recapDefensiveStats;
            if (remoteMap[key]) queueSharedPublicStatePersist(remoteMap[key], data, 'PlayerStats');
        }

        function getStatsSortConfig(type) {
            return statsSortState[type] || { column: 3, direction: 'desc' };
        }

        function getStatsCellValue(row, column) {
            if (!row || row[column] == null) return { type: 'text', value: '' };
            const rawValue = String(row[column]).trim();
            const numeric = Number(rawValue.replace(/[^0-9.-]/g, ''));
            if (rawValue && !Number.isNaN(numeric) && /^-?[0-9]+(?:\.[0-9]+)?$/.test(rawValue.replace(/,/g, ''))) {
                return { type: 'number', value: numeric };
            }
            return { type: 'text', value: rawValue.toLowerCase() };
        }

        function getSortedStatsRows(data, type) {
            const config = getStatsSortConfig(type);
            return data.map(function(row, originalIndex) {
                if (row && row.row && row.originalIndex !== undefined) {
                    return row;
                }
                return { row: row, originalIndex: originalIndex };
            }).sort(function(left, right) {
                const leftValue = getStatsCellValue(left.row, config.column);
                const rightValue = getStatsCellValue(right.row, config.column);

                if (!leftValue.value && !rightValue.value) {
                    return left.originalIndex - right.originalIndex;
                }
                if (!leftValue.value) return 1;
                if (!rightValue.value) return -1;

                if (leftValue.type === 'number' && rightValue.type === 'number') {
                    if (leftValue.value === rightValue.value) {
                        return left.originalIndex - right.originalIndex;
                    }
                    return config.direction === 'asc' ? leftValue.value - rightValue.value : rightValue.value - leftValue.value;
                }

                const compareResult = String(leftValue.value).localeCompare(String(rightValue.value), undefined, { numeric: true, sensitivity: 'base' });
                if (compareResult === 0) {
                    return left.originalIndex - right.originalIndex;
                }
                return config.direction === 'asc' ? compareResult : -compareResult;
            });
        }

        function bindStatsHeaderSorting() {
            [
                { type: 'offensive', tableId: 'offensiveStatsTable', sortableColumns: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
                { type: 'defensive', tableId: 'defensiveStatsTable', sortableColumns: [2, 3, 4, 5, 6, 7] },
                { type: 'recapOffensive', tableId: 'recapOffensiveStatsTable', sortableColumns: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
                { type: 'recapDefensive', tableId: 'recapDefensiveStatsTable', sortableColumns: [2, 3, 4, 5, 6, 7] }
            ].forEach(function(config) {
                const table = document.getElementById(config.tableId);
                const headers = table ? table.querySelectorAll('thead .stats-column-row th') : [];
                if (!headers.length) return;

                headers.forEach(function(header, index) {
                    header.classList.remove('sortable-stat-header', 'sort-asc', 'sort-desc');
                    header.removeAttribute('role');
                    header.removeAttribute('tabindex');
                    header.removeAttribute('title');
                    header.removeAttribute('aria-label');

                    var indicator = header.querySelector('.stat-sort-indicator');
                    if (config.sortableColumns.indexOf(index) === -1) {
                        if (indicator) indicator.remove();
                        return;
                    }

                    header.classList.add('sortable-stat-header');
                    header.setAttribute('role', 'button');
                    header.setAttribute('tabindex', '0');
                    header.setAttribute('title', 'Click to sort. Click again to reverse order.');
                    header.setAttribute('aria-label', header.textContent.trim() + '. Click to sort ascending or descending.');

                    if (!indicator) {
                        indicator = document.createElement('span');
                        indicator.className = 'stat-sort-indicator';
                        indicator.setAttribute('aria-hidden', 'true');
                        header.appendChild(indicator);
                    }
                    indicator.textContent = '';

                    if (statsSortState[config.type].column === index) {
                        header.classList.add(statsSortState[config.type].direction === 'asc' ? 'sort-asc' : 'sort-desc');
                    }

                    if (header.dataset.sortBound === 'true') return;
                    header.dataset.sortBound = 'true';

                    function handleSortTrigger() {
                        if (statsSortState[config.type].column === index) {
                            statsSortState[config.type].direction = statsSortState[config.type].direction === 'desc' ? 'asc' : 'desc';
                        } else {
                            statsSortState[config.type].column = index;
                            statsSortState[config.type].direction = 'desc';
                        }
                        renderAllStats();
                    }

                    header.addEventListener('click', handleSortTrigger);
                    header.addEventListener('keydown', function(event) {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleSortTrigger();
                        }
                    });
                });
            });
        }

        function renderStatsTable(bodyId, key, cols, type, allowEditing, useBlankFallback, overrideData) {
            const tbody = document.getElementById(bodyId);
            if (!tbody) return;
            const isAdmin = !!allowEditing;
            const fallbackRows = useBlankFallback === false ? [] : [cols.map(function() { return ''; })];
            const data = Array.isArray(overrideData) ? overrideData : (loadPlayerStats(key) || fallbackRows);
            const sortedRows = getSortedStatsRows(data, type);
            if (!data.length) {
                tbody.innerHTML = '<tr><td colspan="' + cols.length + '" style="text-align:center; color:#aaa;">No stats recorded yet.</td></tr>';
                return;
            }
            let html = '';
            sortedRows.forEach(function(entry) {
                const row = normalizeStatsRow(entry.row, cols);
                const rIdx = entry.originalIndex;
                html += '<tr>';
                row.forEach(function(cell, cIdx) {
                    if (isAdmin) {
                        if (cIdx === 0) {
                            html += '<td>' + buildStatsTeamAdminEditor(key, rIdx, cell || '') + '</td>';
                        } else {
                            html += '<td><input type="text" value="' + (cell || '') + '" data-statskey="' + key + '" data-row="' + rIdx + '" data-col="' + cIdx + '" style="width:100%;text-align:center;border:1px solid #ddd;padding:4px;"></td>';
                        }
                    } else {
                        if (cIdx === 0) {
                            html += '<td>' + renderStatsTeamCell(cell || '') + '</td>';
                        } else {
                            html += '<td>' + (cell || '\u2014') + '</td>';
                        }
                    }
                });
                if (isAdmin) {
                    html += '<td><button class="cta-button small" style="background:#c62828;padding:2px 8px;font-size:0.75rem;" onclick="removeStatsRow(\'' + bodyId + '\',\'' + key + '\',' + rIdx + ')">✕</button></td>';
                }
                html += '</tr>';
            });
            tbody.innerHTML = html;

            if (isAdmin) {
                tbody.querySelectorAll('input[type="text"]').forEach(function(inp) {
                    inp.addEventListener('input', function() {
                        var r = Number(this.dataset.row);
                        var c = Number(this.dataset.col);
                        var k = this.dataset.statskey;
                        var d = loadPlayerStats(k) || [];
                        if (d[r]) { d[r][c] = this.value; savePlayerStats(k, d); markUnsaved(); }
                    });
                });

                tbody.querySelectorAll('.stats-team-logo-upload').forEach(function(inp) {
                    inp.addEventListener('change', function() {
                        var file = this.files && this.files[0];
                        if (!file) return;
                        var r = Number(this.dataset.row);
                        var k = this.dataset.statskey;
                        var d = loadPlayerStats(k) || [];
                        var teamName = d[r] ? String(d[r][0] || '').trim() : '';
                        if (!teamName) {
                            alert('Please enter the team name before uploading a team logo.');
                            this.value = '';
                            return;
                        }
                        var reader = new FileReader();
                        reader.onload = function(ev) {
                            var dataUrl = ev && ev.target ? ev.target.result : '';
                            if (!dataUrl) return;
                            compressImageDataUrl(dataUrl, STATS_TEAM_LOGO_MAX_WIDTH, STATS_TEAM_LOGO_MAX_HEIGHT, STATS_TEAM_LOGO_QUALITY).then(function(compressed) {
                                setStatsTeamLogo(teamName, compressed);
                                renderAllStats();
                                markUnsaved();
                            }).catch(function() {
                                alert('Unable to process the selected image. Please use a valid JPG, PNG, or GIF file and try again.');
                            });
                        };
                        reader.readAsDataURL(file);
                    });
                });
            }
        }

        function saveCurrentSeasonLabel() {
            if (!isAdminLoggedIn()) return;
            var input = document.getElementById('currentSeasonLabelInput');
            var label = input ? input.value.trim() : '';
            if (!label) label = getDefaultSeasonLabel(0);
            saveSeasonLabel(CURRENT_SEASON_LABEL_KEY, label);
            renderSeasonLabels();
            var msg = document.getElementById('seasonStatsAdminMsg');
            if (msg) {
                msg.style.color = 'green';
                msg.textContent = 'Current season label saved.';
                setTimeout(function() { if (msg.textContent === 'Current season label saved.') msg.textContent = ''; }, 3000);
            }
        }

        function archiveCurrentSeasonToRecap() {
            if (!isAdminLoggedIn()) return;
            var currentLabelInput = document.getElementById('currentSeasonLabelInput');
            var currentLabel = currentLabelInput && currentLabelInput.value.trim() ? currentLabelInput.value.trim() : loadSeasonLabel(CURRENT_SEASON_LABEL_KEY, getDefaultSeasonLabel(0));
            saveSeasonLabel(CURRENT_SEASON_LABEL_KEY, currentLabel);
            var archivedAt = new Date().toISOString();
            var archives = migrateLegacyRecapArchive().filter(function(item) {
                return item.label !== currentLabel;
            });
            var archiveEntry = {
                id: 'archive-' + Date.now(),
                label: currentLabel,
                archivedAt: archivedAt,
                offensive: loadPlayerStats(OFFENSIVE_STATS_KEY) || [],
                defensive: loadPlayerStats(DEFENSIVE_STATS_KEY) || []
            };
            archives.unshift(archiveEntry);
            saveSeasonArchives(archives);
            setSelectedSeasonArchiveId(archiveEntry.id);
            saveSeasonLabel(RECAP_SEASON_LABEL_KEY, currentLabel);

            var nextSeasonLabel = getNextSeasonLabel(currentLabel);
            saveSeasonLabel(CURRENT_SEASON_LABEL_KEY, nextSeasonLabel);
            renderSeasonLabels();
            renderSeasonArchiveSelect();
            renderSeasonRecapStats();
            var msg = document.getElementById('seasonStatsAdminMsg');
            if (msg) {
                msg.style.color = 'green';
                msg.textContent = 'Season archived. Current season advanced to ' + nextSeasonLabel + '.';
                setTimeout(function() { if (msg.textContent === 'Season archived. Current season advanced to ' + nextSeasonLabel + '.') msg.textContent = ''; }, 3000);
            }
        }

        function renderSeasonRecapStats() {
            var selectedArchive = getSelectedSeasonArchive();
            ensureAllStatsFilterUI();
            bindStatsHeaderSorting();
            renderSeasonArchiveSelect();
            renderStatsTable('recapOffensiveStatsBody', '__recapOffensiveVirtual__', offensiveCols, 'recapOffensive', false, false, selectedArchive ? selectedArchive.offensive : []);
            renderStatsTable('recapDefensiveStatsBody', '__recapDefensiveVirtual__', defensiveCols, 'recapDefensive', false, false, selectedArchive ? selectedArchive.defensive : []);
        }

        function addStatsRow(bodyId, type) {
            var key = type === 'offensive' ? OFFENSIVE_STATS_KEY : DEFENSIVE_STATS_KEY;
            var cols = type === 'offensive' ? offensiveCols : defensiveCols;
            var data = loadPlayerStats(key) || [];
            data.push(cols.map(function() { return ''; }));
            savePlayerStats(key, data);
            renderAllStats();
            markUnsaved();
        }

        function removeStatsRow(bodyId, key, rowIdx) {
            var data = loadPlayerStats(key) || [];
            if (data.length <= 1) { alert('Cannot remove the last row.'); return; }
            data.splice(rowIdx, 1);
            savePlayerStats(key, data);
            renderAllStats();
            markUnsaved();
        }

        function renderAllStats() {
            var isAdmin = isAdminLoggedIn();
            var offBtn = document.getElementById('offensiveStatsAdminBtns');
            var defBtn = document.getElementById('defensiveStatsAdminBtns');
            var seasonPanel = document.getElementById('seasonStatsAdminPanel');
            if (offBtn) offBtn.style.display = isAdmin ? 'block' : 'none';
            if (defBtn) defBtn.style.display = isAdmin ? 'block' : 'none';
            if (seasonPanel) seasonPanel.style.display = isAdmin ? 'block' : 'none';

            var offThead = document.querySelector('#offensiveStatsTable thead tr');
            var defThead = document.querySelector('#defensiveStatsTable thead tr');
            if (isAdmin) {
                if (offThead && !offThead.querySelector('.admin-remove-th')) {
                    var th = document.createElement('th'); th.textContent = ''; th.className = 'admin-remove-th'; offThead.appendChild(th);
                }
                if (defThead && !defThead.querySelector('.admin-remove-th')) {
                    var th2 = document.createElement('th'); th2.textContent = ''; th2.className = 'admin-remove-th'; defThead.appendChild(th2);
                }
            } else {
                if (offThead) { var rmTh = offThead.querySelector('.admin-remove-th'); if (rmTh) rmTh.remove(); }
                if (defThead) { var rmTh2 = defThead.querySelector('.admin-remove-th'); if (rmTh2) rmTh2.remove(); }
            }

            renderSeasonLabels();
            bindSeasonRecapSelect();
            ensureAllStatsFilterUI();
            bindStatsHeaderSorting();
            renderStatsTable('offensiveStatsBody', OFFENSIVE_STATS_KEY, offensiveCols, 'offensive', isAdmin, true);
            renderStatsTable('defensiveStatsBody', DEFENSIVE_STATS_KEY, defensiveCols, 'defensive', isAdmin, true);
            renderSeasonRecapStats();
        }
        renderLeagueAdminTables();
        ensureLeagueScheduleResultsUI();
        renderAllStats();

        // page-wide edit state
        let pageEditing = false;
        let persistTimer = null;
        let unsavedChanges = false;
        function markUnsaved() {
            unsavedChanges = true;
            const btn = document.getElementById('saveChangesBtn');
            if (btn) btn.style.background = '#e65100';
            const msg = document.getElementById('saveMsg');
            if (msg) msg.textContent = 'Unsaved changes';
        }
        function flushPersistSiteContent() {
            if (persistTimer) {
                clearTimeout(persistTimer);
                persistTimer = null;
            }
            persistSiteContent();
        }
        function queuePersistSiteContent() {
            if (!pageEditing) return;
            markUnsaved();
        }
        function saveAllChanges() {
            if (!isAdminLoggedIn()) return;
            if (pageEditing) {
                syncLeagueStandingsFromPublicTable();
                syncLeagueScheduleFromPublicTable();
                renderLeagueStandingsPublic();
                renderLeagueSchedulePublic();
            } else {
                saveScheduleFromAdminForm();
            }
            persistSiteContent();
            // also save payment links currently in inputs
            var teamLink = document.getElementById('paypalTeamLink');
            var freeLink = document.getElementById('paypalFreeAgentLink');
            var cashAppLinkEl = document.getElementById('cashAppLink');
            var venmoLinkEl = document.getElementById('venmoLink');
            if (teamLink && freeLink) {
                savePaymentLinks({
                    team: teamLink.value,
                    freeAgent: freeLink.value,
                    cashApp: cashAppLinkEl ? cashAppLinkEl.value : '',
                    venmo: venmoLinkEl ? venmoLinkEl.value : ''
                });
            }
            unsavedChanges = false;
            var btn = document.getElementById('saveChangesBtn');
            if (btn) btn.style.background = '#4caf50';
            var msg = document.getElementById('saveMsg');
            if (msg) { msg.textContent = '✓ All changes saved!'; setTimeout(function(){ msg.textContent = ''; }, 3000); }
        }
        document.addEventListener('input', queuePersistSiteContent, true);
        document.addEventListener('change', queuePersistSiteContent, true);
        window.addEventListener('beforeunload', function(e) {
            flushPersistSiteContent();
            if (unsavedChanges && isAdminLoggedIn()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') flushPersistSiteContent();
            if (document.visibilityState === 'visible') refreshSharedPublicStateForPublicView();
        });

        function setAdminEditableText(enable) {
            var editableSelector = 'header .nav-links a, #home h1, #home p, #home .cta-button, section h2, section h3, section h4, section p, section li, section td, section th, section label, section a, section button, footer p';
            var protectedScopeSelector = '.login-modal, #adminHeader, #memberHeader, #player-stats, #leagueScheduleAdminPanel, #adminOnly, #paypalSettings, #galleryAdminPanel, #playoffAdminPanel, form';

            document.querySelectorAll(editableSelector).forEach(function(el) {
                if (el.closest(protectedScopeSelector)) {
                    el.setAttribute('contenteditable', 'false');
                    return;
                }

                if (enable) {
                    el.setAttribute('contenteditable', 'true');
                } else if (el.getAttribute('contenteditable') === 'true') {
                    el.removeAttribute('contenteditable');
                }
            });
        }

        function enablePageEdit(enable) {
            // HARD GATE: never allow editing unless admin is logged in
            if (!isAdminLoggedIn()) {
                pageEditing = false;
                lockdownForPublic();
                return;
            }
            pageEditing = enable;
            if (enable) {
                setAdminEditableText(true);
                document.body.classList.add('admin-editable');
                // Protect all form controls and protected surfaces from contenteditable
                document.querySelectorAll('form, input, select, textarea, canvas, .login-modal, #memberHeader, #adminHeader, #paymentForm, #leagueScheduleAdminPanel, #player-stats, #adminOnly, #galleryAdminPanel, #playoffAdminPanel').forEach(function(el) {
                    el.setAttribute('contenteditable', 'false');
                });
                // Ensure all admin buttons are clickable (remove contenteditable)
                document.querySelectorAll('#adminOnly button, #adminHeader button, #galleryAdminPanel button, #playoffAdminPanel button').forEach(function(el) {
                    el.removeAttribute('contenteditable');
                });
                document.querySelectorAll('#adminOnly input, #adminOnly select, #adminOnly textarea, #adminOnly button').forEach(function(el) {
                    el.disabled = false;
                });
                document.querySelectorAll('#leagueScheduleAdminPanel input, #leagueScheduleAdminPanel select, #leagueScheduleAdminPanel textarea, #leagueScheduleAdminPanel button').forEach(function(el) {
                    el.disabled = false;
                });
                document.querySelectorAll('#adminOnly .team-logo-input').forEach(function(el) {
                    el.style.display = '';
                });
                enforceNonEditableAdminUI();
                const btn = document.getElementById('togglePageEditBtn');
                if (btn) btn.textContent = 'Disable Editing';
            } else {
                pageEditing = false;
                setAdminEditableText(false);
                document.querySelectorAll('[contenteditable]').forEach(function(el) { el.removeAttribute('contenteditable'); });
                document.body.classList.remove('admin-editable');
                document.querySelectorAll('#adminOnly input, #adminOnly select, #adminOnly textarea, #adminOnly button').forEach(function(el) {
                    el.disabled = false;
                });
                document.querySelectorAll('#leagueScheduleAdminPanel input, #leagueScheduleAdminPanel select, #leagueScheduleAdminPanel textarea, #leagueScheduleAdminPanel button').forEach(function(el) {
                    el.disabled = false;
                });
                document.querySelectorAll('#adminOnly .team-logo-input').forEach(function(el) {
                    el.style.display = '';
                });
                const btn = document.getElementById('togglePageEditBtn');
                if (btn) btn.textContent = 'Enable Editing';
                persistSiteContent();
            }
        }
        function togglePageEdit() {
            if (!isAdminLoggedIn()) return;
            enablePageEdit(!pageEditing);
        }

        // --- end Documents functions ---

        function handleAdminLoginSubmit(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            const adminAccount = getMatchingAdminAccount(username, password);

            if (adminAccount) {
                sessionStorage.setItem('adminLoggedIn', 'true');
                sessionStorage.setItem('adminUsername', adminAccount.username);
                // show feedback inside modal
                const msgEl = document.getElementById('loginError');
                if (msgEl) {
                    msgEl.style.color = 'green';
                    msgEl.textContent = 'Successfully logged in as admin';
                }
                // delay hiding so message is visible briefly
                setTimeout(() => {
                    showAdminView();
                }, 800);
            } else {
                const msgEl = document.getElementById('loginError');
                if (msgEl) {
                    msgEl.style.color = 'red';
                    msgEl.textContent = 'Invalid username or password';
                }
            }
        }

        document.addEventListener('submit', function(e) {
            if (e.target && e.target.id === 'loginForm') {
                handleAdminLoginSubmit(e);
                return;
            }
            if (e.target && e.target.id === 'footerAdminLoginForm') {
                handleFooterAdminLoginSubmit(e);
            }
        });

        function showAdminView() {
            document.getElementById('loginModal').classList.add('hidden');
            document.getElementById('loginModal').style.display = 'none';
            ensureAdminBrandingUI();
            bindAdminBrandingControls();
            setAdminHeaderVisible(true);
            // display username if available
            const adminNameEl = document.getElementById('adminNameDisplay');
            const stored = sessionStorage.getItem('adminUsername');
            if (adminNameEl) adminNameEl.textContent = stored ? '(' + stored + ')' : '';
            updateFooterAdminState();
            document.getElementById('adminOnly').classList.add('visible');
            document.querySelectorAll('.admin-only').forEach(function(el) { el.classList.add('visible'); });
            // show admin nav items
            document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.add('visible'));
            // enable full-page editing
            enablePageEdit(true);
            // refresh admin tables
            renderUsersTableForAdmin();
            renderDocsAdmin && renderDocsAdmin();
            renderLeagueAdminTables && renderLeagueAdminTables();
            renderAllStats && renderAllStats();
            renderAdminPaymentRequests && renderAdminPaymentRequests();
            renderAdminSignupNotifications && renderAdminSignupNotifications();
            renderPayPalSettings && renderPayPalSettings();
            bindPayPalSettingsControls && bindPayPalSettingsControls();
            populateCtaButtonEditor && populateCtaButtonEditor();
            bindCtaButtonControls && bindCtaButtonControls();
            var scheduleAdminPanel = document.getElementById('leagueScheduleAdminPanel');
            if (scheduleAdminPanel) scheduleAdminPanel.classList.add('visible');
            var galleryAdminPanel = document.getElementById('galleryAdminPanel');
            if (galleryAdminPanel) galleryAdminPanel.classList.add('visible');
            var playoffAdminPanel = document.getElementById('playoffAdminPanel');
            if (playoffAdminPanel) playoffAdminPanel.classList.add('visible');
            updateNavQuickSelectOptions('documentsAdmin');
            showPage('documentsAdmin');
            persistSiteContent();
        }

        function logout() {
            saveAllChanges();
            flushPersistSiteContent();
            clearAdminSession();
            // Full public lockdown — removes ALL editing artifacts
            lockdownForPublic();
            updateFooterAdminState();
            var scheduleAdminPanel = document.getElementById('leagueScheduleAdminPanel');
            if (scheduleAdminPanel) scheduleAdminPanel.classList.remove('visible');
            renderLeagueAdminTables && renderLeagueAdminTables();
            // Re-render tables in public (non-admin) mode
            renderAllStats && renderAllStats();
            // Clear login form values
            var modalUser = document.getElementById('username');
            if (modalUser) modalUser.value = '';
            var modalPw = document.getElementById('password');
            if (modalPw) modalPw.value = '';
            var modalMsg = document.getElementById('loginError');
            if (modalMsg) modalMsg.textContent = '';
            var footerMsg = document.getElementById('footerAdminLoginMsg');
            if (footerMsg) {
                footerMsg.style.color = '#ffb366';
                footerMsg.textContent = '';
            }
            var footerUser = document.getElementById('footerAdminUsername');
            if (footerUser) footerUser.value = '';
            var footerPw = document.getElementById('footerAdminPassword');
            if (footerPw) footerPw.value = '';
            // Reset modal to pick step
            var pickStep = document.getElementById('adminPickStep');
            if (pickStep) pickStep.style.display = 'block';
            var passStep = document.getElementById('adminPasswordStep');
            if (passStep) passStep.style.display = 'none';
            updateNavQuickSelectOptions('home');
            showPage('home');
        }

        // Logo upload handling (admin-only)

        // =====================================================
        // PHASE 2, 3, 5: New Features & Accessibility
        // =====================================================
        
        // Back to Top Button
        (function() {
            var backToTopBtn = document.getElementById('backToTop');
            if (!backToTopBtn) return;
            
            function toggleBackToTop() {
                if (window.pageYOffset > 300) {
                    backToTopBtn.classList.add('visible');
                } else {
                    backToTopBtn.classList.remove('visible');
                }
            }
            
            window.addEventListener('scroll', toggleBackToTop);
            
            backToTopBtn.addEventListener('click', function() {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
        })();
        
        // Active Navigation Highlighting
        (function() {
            var sections = document.querySelectorAll('section[id], main[id]');
            var navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
            
            function highlightActiveNav() {
                var scrollPos = window.pageYOffset + 100;
                
                sections.forEach(function(section) {
                    var top = section.offsetTop;
                    var bottom = top + section.offsetHeight;
                    var id = section.getAttribute('id');
                    
                    if (scrollPos >= top && scrollPos < bottom) {
                        navLinks.forEach(function(link) {
                            link.classList.remove('active');
                            if (link.getAttribute('href') === '#' + id) {
                                link.classList.add('active');
                            }
                        });
                    }
                });
            }
            
            window.addEventListener('scroll', highlightActiveNav);
            highlightActiveNav();
        })();
        
        // =====================================================
        // PHASE 6: Security Warnings & Input Sanitization
        // =====================================================
        
        /* SECURITY WARNING:
         * This application stores passwords in plaintext in localStorage.
         * This is NOT secure for production use. Passwords should NEVER be
         * stored in plaintext. For a production application:
         * 
         * 1. Use proper backend authentication (OAuth, JWT, etc.)
         * 2. Hash passwords with bcrypt or similar on the server
         * 3. Use HTTPS for all communications
         * 4. Implement proper session management
         * 5. Add CSRF protection
         * 6. Use secure, httpOnly cookies
         * 
         * This implementation is for demonstration/prototype purposes only.
         */
        
        // XSS Protection: HTML sanitization helper
        function sanitizeHTML(str) {
            if (!str) return '';
            var div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
        
        // Input validation helper
        function validateInput(value, type) {
            if (!value || typeof value !== 'string') return false;
            
            switch(type) {
                case 'email':
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
                case 'username':
                    return /^[a-zA-Z0-9_]{3,20}$/.test(value);
                case 'text':
                    return value.length > 0 && value.length < 1000;
                default:
                    return true;
            }
        }
        
        // =====================================================
        // Search & Filter Functionality for Stats Tables
        // =====================================================
        
        function addTableControls(tableId, options) {
            options = options || {};
            var table = document.getElementById(tableId);
            if (!table) return;
            
            var wrapper = document.createElement('div');
            wrapper.className = 'table-controls';
            
            // Search box
            if (options.search !== false) {
                var searchBox = document.createElement('input');
                searchBox.type = 'text';
                searchBox.className = 'search-box';
                searchBox.placeholder = 'Search players...';
                searchBox.setAttribute('aria-label', 'Search players');
                
                searchBox.addEventListener('input', function() {
                    filterTable(table, this.value, filterDropdown ? filterDropdown.value : '');
                });
                
                wrapper.appendChild(searchBox);
            }
            
            // Filter dropdown
            var filterDropdown = null;
            if (options.filter && options.filterOptions) {
                filterDropdown = document.createElement('select');
                filterDropdown.className = 'filter-dropdown';
                filterDropdown.setAttribute('aria-label', 'Filter by team');
                
                var defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'All Teams';
                filterDropdown.appendChild(defaultOption);
                
                options.filterOptions.forEach(function(opt) {
                    var option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    filterDropdown.appendChild(option);
                });
                
                filterDropdown.addEventListener('change', function() {
                    filterTable(table, searchBox ? searchBox.value : '', this.value);
                });
                
                wrapper.appendChild(filterDropdown);
            }
            
            // Export button
            if (options.export !== false) {
                var exportBtn = document.createElement('button');
                exportBtn.className = 'export-btn';
                exportBtn.innerHTML = '<span class="icon-download"></span>Export to CSV';
                exportBtn.setAttribute('aria-label', 'Export table to CSV');
                
                exportBtn.addEventListener('click', function() {
                    exportTableToCSV(table, options.filename || 'data.csv');
                });
                
                wrapper.appendChild(exportBtn);
            }
            
            table.parentNode.insertBefore(wrapper, table);
            
            // Wrap table for horizontal scrolling on mobile
            if (!table.parentNode.classList.contains('responsive-table-wrapper')) {
                var tableWrapper = document.createElement('div');
                tableWrapper.className = 'responsive-table-wrapper';
                table.parentNode.insertBefore(tableWrapper, table);
                tableWrapper.appendChild(table);
            }
            
            // Add zebra striping class
            if (options.zebra !== false) {
                table.classList.add('zebra');
            }
        }
        
        function filterTable(table, searchText, filterValue) {
            var tbody = table.querySelector('tbody');
            if (!tbody) return;
            
            var rows = tbody.querySelectorAll('tr');
            searchText = searchText.toLowerCase();
            
            rows.forEach(function(row) {
                var text = row.textContent.toLowerCase();
                var matchesSearch = !searchText || text.includes(searchText);
                var matchesFilter = !filterValue || text.includes(filterValue.toLowerCase());
                
                if (matchesSearch && matchesFilter) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }
        
        function exportTableToCSV(table, filename) {
            var csv = [];
            var rows = table.querySelectorAll('tr');
            
            for (var i = 0; i < rows.length; i++) {
                var row = [];
                var cols = rows[i].querySelectorAll('td, th');
                
                for (var j = 0; j < cols.length; j++) {
                    var text = cols[j].textContent.replace(/"/g, '""');
                    row.push('"' + text + '"');
                }
                
                csv.push(row.join(','));
            }
            
            var csvFile = new Blob([csv.join('\n')], { type: 'text/csv' });
            var downloadLink = document.createElement('a');
            downloadLink.download = filename;
            downloadLink.href = window.URL.createObjectURL(csvFile);
            downloadLink.style.display = 'none';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
        
        // =====================================================
        // Loading Indicator
        // =====================================================
        
        function showLoading(message) {
            var overlay = document.querySelector('.loading-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'loading-overlay';
                overlay.innerHTML = '<div class="spinner"></div>';
                if (message) {
                    var msg = document.createElement('p');
                    msg.style.color = 'white';
                    msg.style.marginTop = '20px';
                    msg.textContent = message;
                    overlay.appendChild(msg);
                }
                document.body.appendChild(overlay);
            }
            setTimeout(function() {
                overlay.classList.add('visible');
            }, 10);
            return overlay;
        }
        
        function hideLoading() {
            var overlay = document.querySelector('.loading-overlay');
            if (overlay) {
                overlay.classList.remove('visible');
                setTimeout(function() {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 300);
            }
        }
        
        // =====================================================
        // Confirmation Dialog
        // =====================================================
        
        function confirmAction(message, onConfirm, onCancel) {
            var dialog = document.createElement('div');
            dialog.className = 'confirm-dialog';
            dialog.innerHTML = '<h3>Confirm Action</h3><p>' + sanitizeHTML(message) + '</p><div class="button-group"><button class="confirm-yes">Yes</button><button class="confirm-no">No</button></div>';
            
            document.body.appendChild(dialog);
            setTimeout(function() { dialog.classList.add('visible'); }, 10);
            
            dialog.querySelector('.confirm-yes').addEventListener('click', function() {
                dialog.classList.remove('visible');
                setTimeout(function() {
                    if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
                }, 300);
                if (onConfirm) onConfirm();
            });
            
            dialog.querySelector('.confirm-no').addEventListener('click', function() {
                dialog.classList.remove('visible');
                setTimeout(function() {
                    if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
                }, 300);
                if (onCancel) onCancel();
            });
        }
        
        // =====================================================
        // Form Validation Enhancement
        // =====================================================
        
        function enhanceFormValidation(formId) {
            var form = document.getElementById(formId);
            if (!form) return;
            
            var inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
            
            inputs.forEach(function(input) {
                input.addEventListener('blur', function() {
                    validateField(this);
                });
                
                input.addEventListener('input', function() {
                    if (this.classList.contains('error')) {
                        validateField(this);
                    }
                });
            });
            
            form.addEventListener('submit', function(e) {
                var isValid = true;
                inputs.forEach(function(input) {
                    if (!validateField(input)) {
                        isValid = false;
                    }
                });
                
                if (!isValid) {
                    e.preventDefault();
                }
            });
        }
        
        function validateField(field) {
            var value = field.value.trim();
            var isValid = true;
            var errorMsg = '';
            
            if (field.hasAttribute('required') && !value) {
                isValid = false;
                errorMsg = 'This field is required';
            } else if (field.type === 'email' && value && !validateInput(value, 'email')) {
                isValid = false;
                errorMsg = 'Please enter a valid email address';
            }
            
            if (isValid) {
                field.classList.remove('error');
                field.classList.add('success');
            } else {
                field.classList.remove('success');
                field.classList.add('error');
            }
            
            var existingError = field.parentNode.querySelector('.error-message');
            if (existingError) {
                existingError.textContent = errorMsg;
            } else if (!isValid) {
                var errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = errorMsg;
                field.parentNode.insertBefore(errorDiv, field.nextSibling);
            }
            
            return isValid;
        }
        
        // =====================================================
        // Initialize Enhanced Features
        // =====================================================
        
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initEnhancements);
        } else {
            initEnhancements();
        }
        
        function initEnhancements() {
            // Add table controls to stats tables (if they exist)
            setTimeout(function() {
                // Try to find stats tables and add controls
                var statsTables = document.querySelectorAll('.stats-table, #playerStatsTable, #teamStatsTable');
                statsTables.forEach(function(table, index) {
                    if (table.id) {
                        addTableControls(table.id, {
                            search: true,
                            filter: true,
                            filterOptions: [], // Will be populated dynamically
                            export: true,
                            zebra: true,
                            filename: 'stats-' + index + '.csv'
                        });
                    }
                });
                
                // Enhance forms
                enhanceFormValidation('loginForm');
                enhanceFormValidation('memberRegisterForm');
                enhanceFormValidation('memberLoginForm');
            }, 1000);
        }

        // =====================================================
        // DARK MODE TOGGLE
        // =====================================================
        const DARK_MODE_KEY = 'darkMode_v1';

        function initDarkMode() {
            var saved = localStorage.getItem(DARK_MODE_KEY);
            if (saved === 'light') {
                document.body.classList.add('light-mode');
                updateDarkModeBtn(true);
            } else {
                updateDarkModeBtn(false);
            }
            var btn = document.getElementById('darkModeToggle');
            if (btn && !btn.dataset.dmBound) {
                btn.dataset.dmBound = '1';
                btn.addEventListener('click', function() {
                    var isLight = document.body.classList.toggle('light-mode');
                    try { localStorage.setItem(DARK_MODE_KEY, isLight ? 'light' : 'dark'); } catch (e) {}
                    updateDarkModeBtn(isLight);
                });
            }
        }

        function updateDarkModeBtn(isLight) {
            var btn = document.getElementById('darkModeToggle');
            if (!btn) return;
            btn.textContent = isLight ? '🌑' : '🌙';
            btn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
            btn.setAttribute('title', isLight ? 'Switch to dark mode' : 'Switch to light mode');
        }

        // =====================================================
        // COUNTDOWN TIMER
        // =====================================================
        const COUNTDOWN_DATE_KEY = 'countdownDate_v1';
        var countdownInterval = null;

        function initCountdownTimer() {
            renderCountdownTimer();
            populateCountdownEditor();
            bindCountdownAdminControls();
        }

        function renderCountdownTimer() {
            var timerEl = document.getElementById('countdownTimer');
            if (!timerEl) return;
            if (countdownInterval) clearInterval(countdownInterval);

            var stored = null;
            try { stored = JSON.parse(localStorage.getItem(COUNTDOWN_DATE_KEY) || 'null'); } catch (e) {}
            if (!stored || !stored.date) {
                timerEl.classList.add('hidden');
                return;
            }
            var targetMs = new Date(stored.date).getTime();
            if (isNaN(targetMs)) { timerEl.classList.add('hidden'); return; }
            timerEl.classList.remove('hidden');
            var labelEl = document.getElementById('countdownLabel');
            if (labelEl) labelEl.textContent = stored.label || 'Next Game';

            function tick() {
                var now = Date.now();
                var diff = targetMs - now;
                if (diff <= 0) {
                    clearInterval(countdownInterval);
                    var d = document.getElementById('cdDays'), h = document.getElementById('cdHours'),
                        m = document.getElementById('cdMins'), s = document.getElementById('cdSecs');
                    if (d) d.textContent = '00';
                    if (h) h.textContent = '00';
                    if (m) m.textContent = '00';
                    if (s) s.textContent = '00';
                    return;
                }
                var days   = Math.floor(diff / 86400000);
                var hours  = Math.floor((diff % 86400000) / 3600000);
                var mins   = Math.floor((diff % 3600000) / 60000);
                var secs   = Math.floor((diff % 60000) / 1000);
                function pad(n) { return String(n).padStart(2, '0'); }
                var d = document.getElementById('cdDays'), hEl = document.getElementById('cdHours'),
                    mEl = document.getElementById('cdMins'), sEl = document.getElementById('cdSecs');
                if (d) d.textContent = pad(days);
                if (hEl) hEl.textContent = pad(hours);
                if (mEl) mEl.textContent = pad(mins);
                if (sEl) sEl.textContent = pad(secs);
            }
            tick();
            countdownInterval = setInterval(tick, 1000);
        }

        function populateCountdownEditor() {
            var dateInput = document.getElementById('countdownDateInput');
            var labelInput = document.getElementById('countdownLabelInput');
            if (!dateInput) return;
            try {
                var stored = JSON.parse(localStorage.getItem(COUNTDOWN_DATE_KEY) || 'null');
                if (stored && stored.date) {
                    var d = new Date(stored.date);
                    if (!isNaN(d)) {
                        var local = d.getFullYear() + '-' +
                            String(d.getMonth()+1).padStart(2,'0') + '-' +
                            String(d.getDate()).padStart(2,'0') + 'T' +
                            String(d.getHours()).padStart(2,'0') + ':' +
                            String(d.getMinutes()).padStart(2,'0');
                        dateInput.value = local;
                    }
                }
                if (labelInput && stored && stored.label) labelInput.value = stored.label;
            } catch (e) {}
        }

        function bindCountdownAdminControls() {
            var saveBtn = document.getElementById('saveCountdownSettings');
            var clearBtn = document.getElementById('clearCountdownSettings');
            var msgEl = document.getElementById('countdownAdminMsg');
            if (saveBtn && !saveBtn.dataset.bound) {
                saveBtn.dataset.bound = '1';
                saveBtn.addEventListener('click', function() {
                    if (!isAdminLoggedIn()) return;
                    var dateInput = document.getElementById('countdownDateInput');
                    var labelInput = document.getElementById('countdownLabelInput');
                    var val = dateInput ? dateInput.value : '';
                    if (!val) { if (msgEl) { msgEl.style.color = '#e65100'; msgEl.textContent = 'Please select a date.'; } return; }
                    var label = labelInput ? (labelInput.value.trim() || 'Next Game') : 'Next Game';
                    try {
                        var countdownState = { date: new Date(val).toISOString(), label: label };
                        localStorage.setItem(COUNTDOWN_DATE_KEY, JSON.stringify(countdownState));
                        queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.countdown, countdownState, 'Countdown');
                    } catch (e) {}
                    renderCountdownTimer();
                    if (msgEl) { msgEl.style.color = '#4caf50'; msgEl.textContent = 'Timer saved!'; setTimeout(function() { msgEl.textContent = ''; }, 2000); }
                });
            }
            if (clearBtn && !clearBtn.dataset.bound) {
                clearBtn.dataset.bound = '1';
                clearBtn.addEventListener('click', function() {
                    if (!isAdminLoggedIn()) return;
                    try { localStorage.removeItem(COUNTDOWN_DATE_KEY); } catch (e) {}
                    queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.countdown, null, 'Countdown');
                    var dateInput = document.getElementById('countdownDateInput');
                    var labelInput = document.getElementById('countdownLabelInput');
                    if (dateInput) dateInput.value = '';
                    if (labelInput) labelInput.value = '';
                    renderCountdownTimer();
                    if (msgEl) { msgEl.style.color = '#4caf50'; msgEl.textContent = 'Timer cleared.'; setTimeout(function() { msgEl.textContent = ''; }, 2000); }
                });
            }
        }

        // =====================================================
        // LATEST RESULTS WIDGET
        // =====================================================
        function renderLatestResultsWidget() {
            var body = document.getElementById('latestResultsBody');
            if (!body) return;
            var widget = document.getElementById('latestResultsWidget');
            var hero = document.querySelector('.hero');
            var rows = [];
            try { rows = JSON.parse(localStorage.getItem('leagueSchedule_v1') || '[]'); } catch (e) {}
            if (!Array.isArray(rows)) rows = [];

            // Filter to games with a real score (not "0-0" or empty or "TBD")
            var played = rows.filter(function(r) {
                var s = (r.status || '').trim();
                return s && s !== '0-0' && !/^tbd$/i.test(s) && /\d+\s*-\s*\d+/.test(s);
            });

            if (!played.length) {
                if (widget) widget.classList.add('hidden');
                if (hero) hero.classList.remove('has-results');
                return;
            }

            if (widget) widget.classList.remove('hidden');
            if (hero) hero.classList.add('has-results');

            var recent = played.slice(-3).reverse();
            var html = recent.map(function(r) {
                var parts = (r.status || '0-0').split('-');
                var scoreA = escapeHtml((parts[0] || '0').trim());
                var scoreB = escapeHtml((parts[1] || '0').trim());
                var home = escapeHtml((r.homeTeam || 'Team').substring(0, 18));
                var away = escapeHtml((r.awayTeam || 'Team').substring(0, 18));
                return '<div class="latest-result-card">' +
                    '<span class="latest-result-team">' + home + '</span>' +
                    '<span class="latest-result-score">' + scoreA + '</span>' +
                    '<span class="latest-result-sep">—</span>' +
                    '<span class="latest-result-score">' + scoreB + '</span>' +
                    '<span class="latest-result-team">' + away + '</span>' +
                    '</div>';
            }).join('');
            body.innerHTML = html;
        }

        // =====================================================
        // PHOTO GALLERY
        // =====================================================
        const GALLERY_META_KEY = 'galleryMeta_v1';
        const GALLERY_STORAGE_BUCKET = 'gallery-images';
        const GALLERY_STORAGE_FOLDER = 'uploads';
        const GALLERY_STORAGE_CACHE_SECONDS = '3600';
        var galleryMetaState = [];
        var gallerySupabaseClient = null;
        var gallerySupabaseInitialized = false;
        var galleryIdCounter = 0;
        var galleryEscapeListenerBound = false;

        function loadGalleryMetaCache() {
            return [];
        }

        function saveGalleryMetaCache() {}

        function getGallerySupabaseConfig() {
            return getSiteSupabaseConfig();
        }

        function logGallerySupabaseError(type, message, error) {
            console.error('[Gallery][Supabase][' + type + '] ' + message, error || '');
            logSupabaseRlsHint('Gallery', error);
        }

        function getGallerySupabaseClient() {
            return getSiteSupabaseClient();
        }

        function normalizeGalleryMetaItem(item) {
            if (!item || typeof item !== 'object') return null;
            var id = String(item.id || '').trim();
            var url = String(item.url || item.publicUrl || '').trim();
            var storagePath = String(item.storagePath || item.storage_path || item.path || '').trim();
            var caption = String(item.caption || '').trim();
            var ts = Number(item.ts || item.createdAt || item.created_at || Date.now());
            if (!id) id = generateGalleryId();
            if (!url) return null;
            return {
                id: id,
                url: url,
                storagePath: storagePath,
                caption: caption,
                ts: Number.isFinite(ts) ? ts : Date.now()
            };
        }

        async function verifyGallerySupabaseAuth(client) {
            if (!client) {
                logGallerySupabaseError('Auth', 'Supabase client is unavailable for gallery operations.', null);
                return false;
            }
            return true;
        }

        async function fetchGalleryMetaFromSupabase() {
            var client = getGallerySupabaseClient();
            if (!client) return null;
            var config = getGallerySupabaseConfig();
            try {
                var response = await client
                    .from(config.galleryImagesTable)
                    .select('id, storage_path, public_url, caption, created_at')
                    .order('created_at', { ascending: false });
                if (response.error) {
                    logGallerySupabaseError('Select', 'Failed to fetch gallery rows from table "' + config.galleryImagesTable + '".', response.error);
                    return null;
                }
                var rows = Array.isArray(response.data) ? response.data : [];
                console.info('[Gallery][Supabase][Select] Success.', { rows: rows.length });
                return rows.map(function(row) {
                    return normalizeGalleryMetaItem({
                        id: row.id,
                        storage_path: row.storage_path,
                        url: row.public_url,
                        caption: row.caption,
                        created_at: row.created_at
                    });
                }).filter(Boolean);
            } catch (err) {
                logGallerySupabaseError('Select', 'Unexpected failure while fetching gallery rows.', err);
                return null;
            }
        }

        async function saveGalleryMetaToSupabase(list) {
            var client = getGallerySupabaseClient();
            if (!client) return false;
            var config = getGallerySupabaseConfig();
            try {
                var rows = (Array.isArray(list) ? list : []).map(function(item) {
                    var normalized = normalizeGalleryMetaItem(item);
                    return normalized ? {
                        id: normalized.id,
                        storage_path: normalized.storagePath,
                        public_url: normalized.url,
                        caption: normalized.caption,
                        created_at: new Date(normalized.ts || Date.now()).toISOString()
                    } : null;
                }).filter(Boolean);
                var response = await client
                    .from(config.galleryImagesTable)
                    .upsert(rows, { onConflict: 'id' });
                if (response.error) {
                    logGallerySupabaseError('Insert', 'Failed to insert/update gallery rows in table "' + config.galleryImagesTable + '".', response.error);
                    return false;
                }
                console.info('[Gallery][Supabase][Insert] Success.', { rows: rows.length });
                return true;
            } catch (err) {
                logGallerySupabaseError('Insert', 'Unexpected failure while saving gallery rows.', err);
                return false;
            }
        }

        function getGalleryMeta() {
            return Array.isArray(galleryMetaState) ? galleryMetaState.slice() : [];
        }

        function setGalleryMeta(list, options) {
            var normalizedList = (Array.isArray(list) ? list : [])
                .map(normalizeGalleryMetaItem)
                .filter(Boolean)
                .sort(function(a, b) { return (b.ts || 0) - (a.ts || 0); });
            galleryMetaState = normalizedList;
            if (!(options && options.skipRender)) renderGallery();
            return normalizedList;
        }

        async function hydrateGalleryMeta() {
            var cloudMeta = await fetchGalleryMetaFromSupabase();
            setGalleryMeta(Array.isArray(cloudMeta) ? cloudMeta : [], { skipRender: true });
        }

        function sanitizeGalleryFileName(name) {
            return String(name || 'image')
                .toLowerCase()
                .replace(/[^a-z0-9._-]+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '') || 'image';
        }

        function generateGalleryId() {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return 'g_' + window.crypto.randomUUID();
            }
            galleryIdCounter += 1;
            return 'g_' + Date.now() + '_' + galleryIdCounter + '_' + Math.random().toString(36).slice(2, 10);
        }

        async function uploadGalleryFileToSupabase(file, id) {
            var client = getGallerySupabaseClient();
            if (!client) return null;
            var authOk = await verifyGallerySupabaseAuth(client);
            if (!authOk) return null;
            var config = getGallerySupabaseConfig();
            var safeName = sanitizeGalleryFileName(file && file.name);
            var extension = '';
            var extensionMatch = safeName.match(/(\.[a-z0-9]+)$/);
            if (extensionMatch) extension = extensionMatch[1];
            if (!extension) extension = '.jpg';
            var storagePath = GALLERY_STORAGE_FOLDER + '/' + id + extension;
            var uploadResponse = await client.storage
                .from(config.galleryBucket)
                .upload(storagePath, file, {
                    cacheControl: GALLERY_STORAGE_CACHE_SECONDS,
                    upsert: true,
                    contentType: file && file.type ? file.type : 'image/jpeg'
                });
            if (uploadResponse.error) {
                logGallerySupabaseError('StorageUpload', 'Failed upload to storage bucket "' + config.galleryBucket + '" at path "' + storagePath + '".', uploadResponse.error);
                return null;
            }
            var publicUrlResponse = client.storage.from(config.galleryBucket).getPublicUrl(storagePath);
            var publicUrl = publicUrlResponse && publicUrlResponse.data ? publicUrlResponse.data.publicUrl : '';
            if (!publicUrl) {
                logGallerySupabaseError('StorageUpload', 'Upload succeeded but public URL could not be generated for "' + storagePath + '".', null);
                return null;
            }
            return { storagePath: storagePath, url: publicUrl };
        }

        function updateGalleryNavVisibility(hasImages) {
            var navItem = document.getElementById('navGallery');
            if (!navItem) return;
            var isAdmin = isAdminLoggedIn();
            navItem.style.display = (hasImages || isAdmin) ? '' : 'none';
        }

        function renderGallery() {
            var grid = document.getElementById('galleryGrid');
            if (!grid) return;
            var meta = getGalleryMeta();
            if (!meta.length) {
                grid.innerHTML = '<p class="gallery-empty" id="galleryEmpty">No photos yet — check back soon!</p>';
                updateGalleryNavVisibility(false);
                return;
            }
            var isAdmin = isAdminLoggedIn();
            grid.innerHTML = '';
            meta.forEach(function(item) {
                if (!item.url) return;
                var card = document.createElement('div');
                card.className = 'gallery-card';
                card.setAttribute('tabindex', '0');
                card.setAttribute('role', 'button');
                card.setAttribute('aria-label', 'View photo' + (item.caption ? ': ' + item.caption : ''));

                var img = document.createElement('img');
                img.src = item.url;
                img.alt = item.caption || 'Gallery photo';
                img.loading = 'lazy';
                card.appendChild(img);

                if (item.caption) {
                    var cap = document.createElement('div');
                    cap.className = 'gallery-card-caption';
                    cap.textContent = item.caption;
                    card.appendChild(cap);
                }

                if (isAdmin) {
                    var delBtn = document.createElement('button');
                    delBtn.className = 'gallery-card-delete';
                    delBtn.textContent = '×';
                    delBtn.setAttribute('aria-label', 'Delete photo');
                    delBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        deleteGalleryPhoto(item.id);
                    });
                    card.appendChild(delBtn);
                }

                card.addEventListener('click', function() { openGalleryLightbox(item.url, item.caption || ''); });
                card.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGalleryLightbox(item.url, item.caption || ''); } });
                grid.appendChild(card);
            });
            if (!grid.children.length) {
                grid.innerHTML = '<p class="gallery-empty">No photos yet — check back soon!</p>';
                updateGalleryNavVisibility(false);
            } else {
                updateGalleryNavVisibility(true);
            }
        }

        async function deleteGalleryPhoto(id) {
            var meta = getGalleryMeta();
            var itemToDelete = meta.find(function(m) { return m.id === id; });
            if (!itemToDelete) return;
            var nextMeta = meta.filter(function(m) { return m.id !== id; });
            var client = getGallerySupabaseClient();
            var config = getGallerySupabaseConfig();
            if (!client) return;
            if (itemToDelete.storagePath) {
                try {
                    var removeResponse = await client.storage.from(config.galleryBucket).remove([itemToDelete.storagePath]);
                    if (removeResponse.error) {
                        logGallerySupabaseError('StorageDelete', 'Failed to delete storage object "' + itemToDelete.storagePath + '".', removeResponse.error);
                        return;
                    }
                } catch (err) {
                    logGallerySupabaseError('StorageDelete', 'Unexpected storage deletion failure for "' + itemToDelete.storagePath + '".', err);
                    return;
                }
            }
            try {
                var deleteResponse = await client.from(config.galleryImagesTable).delete().eq('id', id);
                if (deleteResponse.error) {
                    logGallerySupabaseError('Delete', 'Failed to delete gallery row "' + id + '" from table "' + config.galleryImagesTable + '".', deleteResponse.error);
                    return;
                }
                console.info('[Gallery][Supabase][Insert] Delete success.', { id: id });
                setGalleryMeta(nextMeta);
            } catch (err) {
                logGallerySupabaseError('Delete', 'Unexpected failure while deleting gallery row "' + id + '".', err);
            }
        }

        async function uploadGalleryPhotos(files, caption, msgEl) {
            var uploadTasks = files.map(function(file) {
                var id = generateGalleryId();
                return uploadGalleryFileToSupabase(file, id).then(function(uploadResult) {
                    if (!uploadResult) throw new Error('Failed to upload file to Supabase Storage');
                    return {
                        id: id,
                        caption: caption,
                        storagePath: uploadResult.storagePath,
                        url: uploadResult.url,
                        ts: Date.now()
                    };
                });
            });

            var uploadResults = await Promise.allSettled(uploadTasks);
            var failedUploads = uploadResults.filter(function(result) { return result.status === 'rejected'; });
            if (failedUploads.length) {
                var failedReasons = failedUploads.map(function(result) { return result.reason; });
                logGallerySupabaseError('StorageUpload', 'One or more gallery uploads failed.', failedReasons);
                var failedNames = files
                    .filter(function(_, index) { return uploadResults[index].status === 'rejected'; })
                    .map(function(file) { return file && file.name ? file.name : 'unknown'; })
                    .join(', ');
                if (msgEl) {
                    msgEl.style.color = '#ff6f61';
                    msgEl.textContent = 'Upload failed for: ' + failedNames + '. Check console for Supabase details.';
                }
                return false;
            }
            var uploadedItems = uploadResults.map(function(result) { return result.value; });

            var previousMeta = getGalleryMeta();
            var nextMeta = uploadedItems.concat(previousMeta);
            setGalleryMeta(nextMeta);
            var persisted = await saveGalleryMetaToSupabase(nextMeta);
            if (!persisted) {
                setGalleryMeta(previousMeta);
                if (msgEl) {
                    msgEl.style.color = '#ff6f61';
                    msgEl.textContent = 'Photos uploaded, but the gallery_images table insert failed. Check console errors.';
                }
                return false;
            }
            return true;
        }

        async function refreshGalleryFromSupabaseAndRender() {
            await hydrateGalleryMeta();
            renderGallery();
        }

        function initGallery() {
            refreshGalleryFromSupabaseAndRender();

            var closeBtn = document.getElementById('galleryLightboxClose');
            if (closeBtn && !closeBtn.dataset.bound) {
                closeBtn.dataset.bound = '1';
                closeBtn.addEventListener('click', closeGalleryLightbox);
            }
            var lb = document.getElementById('galleryLightbox');
            if (lb && !lb.dataset.bound) {
                lb.dataset.bound = '1';
                lb.addEventListener('click', function(e) { if (e.target === lb) closeGalleryLightbox(); });
            }
            if (!galleryEscapeListenerBound) {
                galleryEscapeListenerBound = true;
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') closeGalleryLightbox();
                });
            }

            var uploadBtn = document.getElementById('galleryUploadBtn');
            if (uploadBtn && !uploadBtn.dataset.bound) {
                uploadBtn.dataset.bound = '1';
                uploadBtn.addEventListener('click', async function() {
                    if (!isAdminLoggedIn()) return;
                    var fileInput = document.getElementById('galleryUploadInput');
                    var captionInput = document.getElementById('galleryCaption');
                    var msgEl = document.getElementById('galleryUploadMsg');
                    var files = fileInput && fileInput.files ? Array.from(fileInput.files) : [];
                    if (!files.length) { if (msgEl) { msgEl.style.color = '#e65100'; msgEl.textContent = 'Please select at least one image.'; } return; }
                    var caption = captionInput ? captionInput.value.trim() : '';
                    if (msgEl) { msgEl.style.color = '#ff8f00'; msgEl.textContent = 'Uploading…'; }
                    uploadBtn.disabled = true;
                    try {
                        var success = await uploadGalleryPhotos(files, caption, msgEl);
                        if (success) {
                            if (fileInput) fileInput.value = '';
                            if (captionInput) captionInput.value = '';
                            if (msgEl) { msgEl.style.color = '#4caf50'; msgEl.textContent = files.length + ' photo(s) uploaded!'; setTimeout(function() { msgEl.textContent = ''; }, 3000); }
                        }
                    } finally {
                        uploadBtn.disabled = false;
                    }
                });
            }
        }

        function openGalleryLightbox(src, caption) {
            var lb = document.getElementById('galleryLightbox');
            var img = document.getElementById('galleryLightboxImg');
            var cap = document.getElementById('galleryLightboxCaption');
            if (!lb || !img) return;
            img.src = src;
            img.alt = caption || 'Gallery photo';
            if (cap) cap.textContent = caption || '';
            lb.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }

        function closeGalleryLightbox() {
            var lb = document.getElementById('galleryLightbox');
            if (lb) lb.style.display = 'none';
            document.body.style.overflow = '';
        }

        // =====================================================
        // PLAYOFF BRACKET
        // =====================================================
        const PLAYOFF_BRACKET_KEY = 'playoffBracket_v1';

        function loadPlayoffBracket() {
            try { return JSON.parse(localStorage.getItem(PLAYOFF_BRACKET_KEY) || '[]'); } catch (e) { return []; }
        }
        function savePlayoffBracket() {
            if (!isAdminLoggedIn()) return;
            var rounds = collectPlayoffRounds();
            try { localStorage.setItem(PLAYOFF_BRACKET_KEY, JSON.stringify(rounds)); } catch (e) {}
            queueSharedPublicStatePersist(SUPABASE_PUBLIC_STATE_KEYS.playoffBracket, rounds, 'Playoff');
            renderPlayoffBracket();
            var msg = document.getElementById('playoffAdminMsg');
            if (msg) { msg.style.color = '#4caf50'; msg.textContent = 'Bracket saved!'; setTimeout(function() { msg.textContent = ''; }, 2500); }
        }

        function collectPlayoffRounds() {
            var editor = document.getElementById('playoffRoundsEditor');
            if (!editor) return [];
            var rounds = [];
            editor.querySelectorAll('.playoff-round-editor').forEach(function(roundEl) {
                var titleInput = roundEl.querySelector('.playoff-round-title-input');
                var round = { title: titleInput ? titleInput.value.trim() || 'Round' : 'Round', matchups: [] };
                roundEl.querySelectorAll('.playoff-matchup-editor').forEach(function(matchupEl) {
                    var inputs = matchupEl.querySelectorAll('input');
                    round.matchups.push({
                        teamA: inputs[0] ? inputs[0].value.trim() : '',
                        teamB: inputs[1] ? inputs[1].value.trim() : '',
                        scoreA: inputs[2] ? inputs[2].value.trim() : '',
                        scoreB: inputs[3] ? inputs[3].value.trim() : ''
                    });
                });
                rounds.push(round);
            });
            return rounds;
        }

        function addPlayoffRound() {
            var editor = document.getElementById('playoffRoundsEditor');
            if (!editor) return;
            var roundIdx = editor.querySelectorAll('.playoff-round-editor').length;
            var titles = ['Quarterfinals', 'Semifinals', 'Championship'];
            var defaultTitle = titles[roundIdx] || ('Round ' + (roundIdx + 1));
            var div = document.createElement('div');
            div.className = 'playoff-round-editor';
            div.innerHTML =
                '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
                    '<input class="playoff-round-title-input" type="text" value="' + escapeHtml(defaultTitle) + '" placeholder="Round name" style="flex:1;padding:7px 10px;background:#0f0f23;border:1px solid #2a2a4a;border-radius:4px;color:#ff8f00;font-weight:700;">' +
                    '<button type="button" class="cta-button small" style="background:#c62828;" onclick="this.closest(\'.playoff-round-editor\').remove()">Remove Round</button>' +
                '</div>' +
                '<div class="playoff-matchup-editor">' +
                    '<input type="text" placeholder="Team A name">' +
                    '<input type="text" placeholder="Team B name">' +
                    '<input type="number" placeholder="Score A" min="0">' +
                    '<input type="number" placeholder="Score B" min="0">' +
                '</div>';
            var addMatchupBtn = document.createElement('button');
            addMatchupBtn.type = 'button';
            addMatchupBtn.className = 'cta-button small';
            addMatchupBtn.style.marginTop = '6px';
            addMatchupBtn.textContent = '+ Add Matchup';
            addMatchupBtn.addEventListener('click', function() {
                var matchupDiv = document.createElement('div');
                matchupDiv.className = 'playoff-matchup-editor';
                matchupDiv.innerHTML =
                    '<input type="text" placeholder="Team A name">' +
                    '<input type="text" placeholder="Team B name">' +
                    '<input type="number" placeholder="Score A" min="0">' +
                    '<input type="number" placeholder="Score B" min="0">';
                div.insertBefore(matchupDiv, addMatchupBtn);
            });
            div.appendChild(addMatchupBtn);
            editor.appendChild(div);
        }

        function renderPlayoffBracket() {
            var display = document.getElementById('playoffBracketDisplay');
            if (!display) return;
            var rounds = loadPlayoffBracket();
            if (!rounds.length) {
                display.innerHTML = '<p class="playoff-empty">Playoff bracket will be posted when the season begins.</p>';
                return;
            }
            var wrapper = document.createElement('div');
            wrapper.className = 'bracket-wrapper';
            rounds.forEach(function(round) {
                var col = document.createElement('div');
                col.className = 'bracket-round';
                var title = document.createElement('div');
                title.className = 'bracket-round-title';
                title.textContent = round.title || 'Round';
                col.appendChild(title);
                (round.matchups || []).forEach(function(m) {
                    var box = document.createElement('div');
                    box.className = 'bracket-matchup';
                    var sA = parseInt(m.scoreA, 10) || 0;
                    var sB = parseInt(m.scoreB, 10) || 0;
                    var hasScores = m.scoreA !== '' || m.scoreB !== '';
                    var teamAWon = hasScores && sA > sB;
                    var teamBWon = hasScores && sB > sA;
                    box.innerHTML =
                        '<div class="bracket-team ' + (teamAWon ? 'winner' : teamBWon ? 'loser' : '') + '">' +
                            '<span class="bracket-team-name">' + escapeHtml(m.teamA || 'TBD') + '</span>' +
                            '<span class="bracket-team-score">' + escapeHtml(m.scoreA !== '' ? m.scoreA : '—') + '</span>' +
                        '</div>' +
                        '<div class="bracket-team ' + (teamBWon ? 'winner' : teamAWon ? 'loser' : '') + '">' +
                            '<span class="bracket-team-name">' + escapeHtml(m.teamB || 'TBD') + '</span>' +
                            '<span class="bracket-team-score">' + escapeHtml(m.scoreB !== '' ? m.scoreB : '—') + '</span>' +
                        '</div>';
                    col.appendChild(box);
                });
                wrapper.appendChild(col);
            });
            display.innerHTML = '';
            display.appendChild(wrapper);
        }

        function populatePlayoffEditor() {
            var editor = document.getElementById('playoffRoundsEditor');
            if (!editor) return;
            editor.innerHTML = '';
            var rounds = loadPlayoffBracket();
            rounds.forEach(function(round) {
                addPlayoffRound();
                var lastRoundEl = editor.lastElementChild;
                if (!lastRoundEl) return;
                var titleInput = lastRoundEl.querySelector('.playoff-round-title-input');
                if (titleInput) titleInput.value = round.title || '';
                // Remove the default empty matchup
                lastRoundEl.querySelectorAll('.playoff-matchup-editor').forEach(function(el) { el.remove(); });
                var addBtn = lastRoundEl.querySelector('button.cta-button.small:not([style*="c62828"])');
                (round.matchups || []).forEach(function(m) {
                    var matchupDiv = document.createElement('div');
                    matchupDiv.className = 'playoff-matchup-editor';
                    matchupDiv.innerHTML =
                        '<input type="text" placeholder="Team A name" value="' + escapeHtml(m.teamA || '') + '">' +
                        '<input type="text" placeholder="Team B name" value="' + escapeHtml(m.teamB || '') + '">' +
                        '<input type="number" placeholder="Score A" min="0" value="' + escapeHtml(m.scoreA || '') + '">' +
                        '<input type="number" placeholder="Score B" min="0" value="' + escapeHtml(m.scoreB || '') + '">';
                    if (addBtn) lastRoundEl.insertBefore(matchupDiv, addBtn);
                    else lastRoundEl.appendChild(matchupDiv);
                });
            });
        }

        // =====================================================
        // FAQ ACCORDION
        // =====================================================
        function initFAQ() {
            var list = document.getElementById('faqList');
            if (!list || list.dataset.faqBound) return;
            list.dataset.faqBound = '1';
            list.addEventListener('click', function(e) {
                var btn = e.target.closest('.faq-question');
                if (!btn) return;
                var answer = btn.nextElementSibling;
                var expanded = btn.getAttribute('aria-expanded') === 'true';
                // Close all others
                list.querySelectorAll('.faq-question').forEach(function(q) {
                    if (q !== btn) {
                        q.setAttribute('aria-expanded', 'false');
                        var a = q.nextElementSibling;
                        if (a) a.setAttribute('hidden', '');
                    }
                });
                btn.setAttribute('aria-expanded', String(!expanded));
                if (expanded) { answer.setAttribute('hidden', ''); }
                else { answer.removeAttribute('hidden'); }
            });
        }

        // =====================================================
        // NEWSLETTER FORM
        // =====================================================
        const NEWSLETTER_SUBS_KEY = 'newsletterSubs_v1';

        function initNewsletter() {
            var form = document.getElementById('newsletterForm');
            if (!form || form.dataset.bound) return;
            form.dataset.bound = '1';
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                var nameInput = document.getElementById('newsletterName');
                var emailInput = document.getElementById('newsletterEmail');
                var msgEl = document.getElementById('newsletterMsg');
                var email = emailInput ? emailInput.value.trim() : '';
                if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    if (msgEl) { msgEl.style.color = '#e65100'; msgEl.textContent = 'Please enter a valid email address.'; }
                    return;
                }
                // Store subscriber locally (admin can view later)
                try {
                    var subs = JSON.parse(localStorage.getItem(NEWSLETTER_SUBS_KEY) || '[]');
                    var exists = subs.some(function(s) { return s.email === email; });
                    if (!exists) {
                        subs.push({ name: nameInput ? nameInput.value.trim() : '', email: email, ts: new Date().toISOString() });
                        localStorage.setItem(NEWSLETTER_SUBS_KEY, JSON.stringify(subs));
                    }
                } catch (err) {}
                if (msgEl) { msgEl.style.color = '#4caf50'; msgEl.textContent = '✅ Thanks for subscribing! We\'ll keep you updated.'; }
                form.reset();
            });
        }

        // =====================================================
        // INITIALIZE ALL NEW FEATURES
        // =====================================================
        (function initNewFeatures() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', runNewFeatureInits);
            } else {
                runNewFeatureInits();
            }
        })();

        function runNewFeatureInits() {
            initDarkMode();
            initCountdownTimer();
            renderLatestResultsWidget();
            renderPlayoffBracket();
            initFAQ();
            initNewsletter();
            // Gallery init deferred slightly to avoid contention with IDB loading
            setTimeout(function() {
                initGallery();
                // Populate admin-only editors
                if (isAdminLoggedIn()) {
                    populatePlayoffEditor();
                    populateCountdownEditor();
                }
            }, 600);
        }

        // Re-run on window.load as well to catch any timing issues
        window.addEventListener('load', function() {
            initDarkMode();
            renderLatestResultsWidget();
            renderPlayoffBracket();
            initFAQ();
            initNewsletter();
            initGallery();
            if (isAdminLoggedIn()) {
                populatePlayoffEditor();
                populateCountdownEditor();
                // Show gallery admin panel
                var galAdmin = document.getElementById('galleryAdminPanel');
                if (galAdmin) galAdmin.classList.add('visible');
                var playoffAdmin = document.getElementById('playoffAdminPanel');
                if (playoffAdmin) playoffAdmin.classList.add('visible');
            }
        });

/* =============================================
   Scroll-Reveal Observer
   ============================================= */
(function initScrollReveal() {
    if (!('IntersectionObserver' in window)) {
        // Fallback: just reveal everything immediately
        document.querySelectorAll('.reveal, .reveal-scale, .reveal-stagger').forEach(function(el) {
            el.classList.add('revealed');
        });
        return;
    }

    var revealObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.reveal, .reveal-scale, .reveal-stagger').forEach(function(el) {
        revealObserver.observe(el);
    });
})();
