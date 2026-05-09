/**
 * utils.js — Pure utility functions for 865 Elite Flag Football.
 *
 * This file contains stateless helper functions that are shared between
 * the browser (loaded via <script src="js/utils.js">) and the Jest test
 * suite.  Functions here must have NO side-effects and must NOT read or
 * write to the DOM, localStorage, or sessionStorage directly.
 */

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// League schedule — team name helpers
// ---------------------------------------------------------------------------

function getScheduleTeamInitials(name) {
    var words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'TBD';
    return words.slice(0, 2).map(function(word) {
        return word.charAt(0).toUpperCase();
    }).join('');
}

// ---------------------------------------------------------------------------
// League schedule — result / score helpers
// ---------------------------------------------------------------------------

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

/**
 * Parses a result string such as "21-14" into its component parts.
 * Returns { leftScore, rightScore, hasPair }.
 */
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

/**
 * Returns the left and right numeric score parts for the admin score editor.
 * Non-numeric values are coerced to '0'.
 */
function getScheduleAdminScoreParts(text) {
    var parsed = parseScheduleResultText(text);
    var left = String(parsed.leftScore || '0').trim();
    var right = String(parsed.rightScore || '0').trim();
    return {
        left: /^\d+$/.test(left) ? left : '0',
        right: /^\d+$/.test(right) ? right : '0'
    };
}

/**
 * Determines the win/loss outcome for home and away teams from a score string.
 * Returns { home: 'win'|'loss'|'', away: 'win'|'loss'|'' }.
 */
function getScheduleResultOutcome(text) {
    var result = parseScheduleResultText(normalizeScheduleResultText(text));
    var left = Number(result.leftScore);
    var right = Number(result.rightScore);
    if (!result.hasPair || Number.isNaN(left) || Number.isNaN(right) || left === right) {
        return { home: '', away: '' };
    }
    return left > right ? { home: 'win', away: 'loss' } : { home: 'loss', away: 'win' };
}

// ---------------------------------------------------------------------------
// League schedule — row normalisation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Season label helpers
// ---------------------------------------------------------------------------

function getDefaultSeasonLabel(offset) {
    return String(new Date().getFullYear() + (offset || 0)) + ' Season';
}

/**
 * Increments the four-digit year found in `label` by one.
 * Falls back to next year's default label when no year is found.
 */
function getNextSeasonLabel(label) {
    var text = String(label || '').trim();
    var match = text.match(/(19|20)\d{2}/);
    if (!match) return getDefaultSeasonLabel(1);
    var nextYear = String(Number(match[0]) + 1);
    return text.replace(match[0], nextYear);
}

/**
 * Formats the `archivedAt` ISO timestamp for display.
 * Returns a user-friendly "Archive has not been updated yet." message when the
 * value is missing or unparseable.
 */
function formatArchiveUpdatedAt(value) {
    if (!value) return 'Archive has not been updated yet.';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Archive has not been updated yet.';
    return 'Last updated: ' + date.toLocaleString();
}

// ---------------------------------------------------------------------------
// Player stats — row helpers
// ---------------------------------------------------------------------------

/**
 * Normalises a raw stats data row to match the column count of `cols`.
 * Missing indices are filled with an empty string.
 */
function normalizeStatsRow(row, cols) {
    return cols.map(function(_, index) {
        return row && row[index] !== undefined ? row[index] : '';
    });
}

/**
 * Creates a blank league data row (object) with empty strings for every field.
 */
function blankLeagueRow(fields) {
    var row = {};
    fields.forEach(function(field) {
        row[field.key] = '';
    });
    return row;
}

/**
 * Shallow-clones each row in `rows` so mutations do not affect the originals.
 */
function cloneRows(rows) {
    return rows.map(function(row) {
        return Object.assign({}, row);
    });
}

// ---------------------------------------------------------------------------
// Player stats — sorting helpers
// ---------------------------------------------------------------------------

/**
 * Extracts a comparable value from a stats cell.
 * Returns { type: 'number'|'text', value: number|string }.
 */
function getStatsCellValue(row, column) {
    if (!row || row[column] == null) return { type: 'text', value: '' };
    var rawValue = String(row[column]).trim();
    var numeric = Number(rawValue.replace(/[^0-9.-]/g, ''));
    if (rawValue && !Number.isNaN(numeric) && /^-?[0-9]+(?:\.[0-9]+)?$/.test(rawValue.replace(/,/g, ''))) {
        return { type: 'number', value: numeric };
    }
    return { type: 'text', value: rawValue.toLowerCase() };
}

/**
 * Returns the default sort configuration for a given stats table type.
 */
function getDefaultStatsSortConfig(type) {
    if (type === 'defensive' || type === 'recapDefensive') {
        return { column: 3, direction: 'desc' };
    }
    return { column: 3, direction: 'desc' };
}

/**
 * Sorts `data` rows according to `sortConfig` = { column, direction }.
 * Rows are wrapped in { row, originalIndex } objects so stable sort order is
 * preserved when values are equal.
 */
function getSortedStatsRows(data, sortConfig) {
    var config = sortConfig || { column: 3, direction: 'desc' };
    return data.map(function(row, originalIndex) {
        if (row && row.row && row.originalIndex !== undefined) {
            return row;
        }
        return { row: row, originalIndex: originalIndex };
    }).sort(function(left, right) {
        var leftValue = getStatsCellValue(left.row, config.column);
        var rightValue = getStatsCellValue(right.row, config.column);

        if (!leftValue.value && !rightValue.value) {
            return left.originalIndex - right.originalIndex;
        }
        if (!leftValue.value) return 1;
        if (!rightValue.value) return -1;

        if (leftValue.type === 'number' && rightValue.type === 'number') {
            if (leftValue.value === rightValue.value) {
                return left.originalIndex - right.originalIndex;
            }
            return config.direction === 'asc'
                ? leftValue.value - rightValue.value
                : rightValue.value - leftValue.value;
        }

        var compareResult = String(leftValue.value).localeCompare(
            String(rightValue.value),
            undefined,
            { numeric: true, sensitivity: 'base' }
        );
        if (compareResult === 0) {
            return left.originalIndex - right.originalIndex;
        }
        return config.direction === 'asc' ? compareResult : -compareResult;
    });
}

// ---------------------------------------------------------------------------
// Admin account helpers
// ---------------------------------------------------------------------------

/**
 * Searches `accounts` for a matching { username, password } pair.
 * Returns the matching account object or null.
 * This function is pure — the accounts list is passed as a parameter.
 */
function findMatchingAdminAccount(accounts, username, password) {
    return (accounts || []).find(function(account) {
        return account.username === username && account.password === password;
    }) || null;
}

// ---------------------------------------------------------------------------
// Universal module export (browser global + CommonJS for Jest)
// ---------------------------------------------------------------------------

/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escapeHtml,
        getScheduleTeamInitials,
        normalizeScheduleResultText,
        parseLegacyMatchup,
        parseScheduleResultText,
        getScheduleAdminScoreParts,
        getScheduleResultOutcome,
        normalizeLeagueScheduleRow,
        getDefaultSeasonLabel,
        getNextSeasonLabel,
        formatArchiveUpdatedAt,
        normalizeStatsRow,
        blankLeagueRow,
        cloneRows,
        getStatsCellValue,
        getDefaultStatsSortConfig,
        getSortedStatsRows,
        findMatchingAdminAccount
    };
}
