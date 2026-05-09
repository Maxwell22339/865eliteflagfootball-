'use strict';

/**
 * tests/utils.test.js
 *
 * Comprehensive tests for the pure utility functions in js/utils.js.
 * These functions have no side-effects (no DOM, localStorage, or network)
 * so they can be exercised with plain Jest in a Node environment.
 */

const {
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
} = require('../js/utils');

// ============================================================================
// escapeHtml
// ============================================================================

describe('escapeHtml', () => {
    test('escapes ampersands', () => {
        expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    test('escapes less-than', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    test('escapes greater-than', () => {
        expect(escapeHtml('1 > 0')).toBe('1 &gt; 0');
    });

    test('escapes double quotes', () => {
        expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    test('escapes single quotes', () => {
        expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    test('escapes all special characters in one string', () => {
        expect(escapeHtml('<a href="test" data-x=\'y\'>A & B</a>'))
            .toBe('&lt;a href=&quot;test&quot; data-x=&#39;y&#39;&gt;A &amp; B&lt;/a&gt;');
    });

    test('returns empty string for null', () => {
        expect(escapeHtml(null)).toBe('');
    });

    test('returns empty string for undefined', () => {
        expect(escapeHtml(undefined)).toBe('');
    });

    test('converts numbers to strings', () => {
        expect(escapeHtml(42)).toBe('42');
    });

    test('leaves plain text unchanged', () => {
        expect(escapeHtml('hello world')).toBe('hello world');
    });

    test('handles empty string', () => {
        expect(escapeHtml('')).toBe('');
    });
});

// ============================================================================
// getScheduleTeamInitials
// ============================================================================

describe('getScheduleTeamInitials', () => {
    test('returns first letter of first two words, uppercased', () => {
        expect(getScheduleTeamInitials('865 Elite Flag Football')).toBe('8E');
    });

    test('returns single letter for single-word name', () => {
        expect(getScheduleTeamInitials('Eagles')).toBe('E');
    });

    test('returns TBD for empty string', () => {
        expect(getScheduleTeamInitials('')).toBe('TBD');
    });

    test('returns TBD for null', () => {
        expect(getScheduleTeamInitials(null)).toBe('TBD');
    });

    test('returns TBD for undefined', () => {
        expect(getScheduleTeamInitials(undefined)).toBe('TBD');
    });

    test('handles whitespace-only input', () => {
        expect(getScheduleTeamInitials('   ')).toBe('TBD');
    });

    test('uppercases lowercase first letters', () => {
        expect(getScheduleTeamInitials('green bay')).toBe('GB');
    });

    test('only uses first two words even if more exist', () => {
        expect(getScheduleTeamInitials('A B C D E')).toBe('AB');
    });

    test('handles extra whitespace between words', () => {
        expect(getScheduleTeamInitials('Team  Name')).toBe('TN');
    });
});

// ============================================================================
// normalizeScheduleResultText
// ============================================================================

describe('normalizeScheduleResultText', () => {
    test('returns value unchanged when it is a score', () => {
        expect(normalizeScheduleResultText('21-14')).toBe('21-14');
    });

    test('returns 0-0 for empty string', () => {
        expect(normalizeScheduleResultText('')).toBe('0-0');
    });

    test('returns 0-0 for null', () => {
        expect(normalizeScheduleResultText(null)).toBe('0-0');
    });

    test('returns 0-0 for undefined', () => {
        expect(normalizeScheduleResultText(undefined)).toBe('0-0');
    });

    test('returns 0-0 for "upcoming" (case-insensitive)', () => {
        expect(normalizeScheduleResultText('upcoming')).toBe('0-0');
        expect(normalizeScheduleResultText('UPCOMING')).toBe('0-0');
        expect(normalizeScheduleResultText('Upcoming')).toBe('0-0');
    });

    test('trims whitespace', () => {
        expect(normalizeScheduleResultText('  7-0  ')).toBe('7-0');
    });

    test('passes through dash-only strings', () => {
        expect(normalizeScheduleResultText('—')).toBe('—');
    });
});

// ============================================================================
// parseLegacyMatchup
// ============================================================================

describe('parseLegacyMatchup', () => {
    test('splits on " vs "', () => {
        expect(parseLegacyMatchup('Team A vs Team B')).toEqual({
            homeTeam: 'Team A',
            awayTeam: 'Team B'
        });
    });

    test('splits on " vs. " (with period)', () => {
        expect(parseLegacyMatchup('Team A vs. Team B')).toEqual({
            homeTeam: 'Team A',
            awayTeam: 'Team B'
        });
    });

    test('is case-insensitive for "VS"', () => {
        expect(parseLegacyMatchup('Team A VS Team B')).toEqual({
            homeTeam: 'Team A',
            awayTeam: 'Team B'
        });
    });

    test('returns full text as homeTeam when no vs separator found', () => {
        expect(parseLegacyMatchup('Team A')).toEqual({
            homeTeam: 'Team A',
            awayTeam: ''
        });
    });

    test('returns empty strings for empty input', () => {
        expect(parseLegacyMatchup('')).toEqual({ homeTeam: '', awayTeam: '' });
    });

    test('returns empty strings for null', () => {
        expect(parseLegacyMatchup(null)).toEqual({ homeTeam: '', awayTeam: '' });
    });

    test('handles multiple "vs" in the away team name', () => {
        // "Team A vs Team B vs Team C" — homeTeam is "Team A", awayTeam joins remainder
        const result = parseLegacyMatchup('Team A vs Team B vs Team C');
        expect(result.homeTeam).toBe('Team A');
        expect(result.awayTeam).toBe('Team B vs Team C');
    });

    test('trims surrounding whitespace from team names', () => {
        const result = parseLegacyMatchup('  Alpha  vs  Beta  ');
        expect(result.homeTeam).toBe('Alpha');
        expect(result.awayTeam).toBe('Beta');
    });

    test('treats leading-whitespace-only input before vs as homeTeam (trim makes it non-empty-split)', () => {
        // ' vs Beta' → trim() → 'vs Beta' → no regex match (no \s+ before vs)
        // → parts.length === 1 → returns full text as homeTeam
        const result = parseLegacyMatchup(' vs Beta');
        expect(result.homeTeam).toBe('vs Beta');
        expect(result.awayTeam).toBe('');
    });
});

// ============================================================================
// parseScheduleResultText
// ============================================================================

describe('parseScheduleResultText', () => {
    test('parses a valid score string', () => {
        expect(parseScheduleResultText('21-14')).toEqual({
            leftScore: '21',
            rightScore: '14',
            hasPair: true
        });
    });

    test('parses a score with spaces around dash', () => {
        expect(parseScheduleResultText('7 - 3')).toEqual({
            leftScore: '7',
            rightScore: '3',
            hasPair: true
        });
    });

    test('returns hasPair: false when no dash', () => {
        const result = parseScheduleResultText('no score');
        expect(result.hasPair).toBe(false);
        expect(result.leftScore).toBe('no score');
    });

    test('returns em-dash for rightScore when no dash present', () => {
        const result = parseScheduleResultText('pending');
        expect(result.rightScore).toBe('\u2014');
    });

    test('normalizes "upcoming" to 0-0 before parsing', () => {
        expect(parseScheduleResultText('upcoming')).toEqual({
            leftScore: '0',
            rightScore: '0',
            hasPair: true
        });
    });

    test('normalizes empty string to 0-0', () => {
        expect(parseScheduleResultText('')).toEqual({
            leftScore: '0',
            rightScore: '0',
            hasPair: true
        });
    });

    test('handles null gracefully', () => {
        const result = parseScheduleResultText(null);
        expect(result.hasPair).toBe(true); // null → "0-0" → hasPair true
    });
});

// ============================================================================
// getScheduleAdminScoreParts
// ============================================================================

describe('getScheduleAdminScoreParts', () => {
    test('extracts numeric left and right scores', () => {
        expect(getScheduleAdminScoreParts('14-7')).toEqual({ left: '14', right: '7' });
    });

    test('returns "0" for non-numeric segments', () => {
        expect(getScheduleAdminScoreParts('TBD-TBD')).toEqual({ left: '0', right: '0' });
    });

    test('returns "0"-"0" for empty input', () => {
        expect(getScheduleAdminScoreParts('')).toEqual({ left: '0', right: '0' });
    });

    test('handles the em-dash result from no-score parsing', () => {
        // "—" has no "-" so parseScheduleResultText returns hasPair:false
        // leftScore is "—", rightScore is "—"
        expect(getScheduleAdminScoreParts('—')).toEqual({ left: '0', right: '0' });
    });

    test('handles single digit scores', () => {
        expect(getScheduleAdminScoreParts('7-0')).toEqual({ left: '7', right: '0' });
    });

    test('handles three-digit scores', () => {
        expect(getScheduleAdminScoreParts('100-99')).toEqual({ left: '100', right: '99' });
    });
});

// ============================================================================
// getScheduleResultOutcome
// ============================================================================

describe('getScheduleResultOutcome', () => {
    test('returns win/loss when home score is higher', () => {
        expect(getScheduleResultOutcome('21-7')).toEqual({ home: 'win', away: 'loss' });
    });

    test('returns loss/win when away score is higher', () => {
        expect(getScheduleResultOutcome('7-21')).toEqual({ home: 'loss', away: 'win' });
    });

    test('returns empty strings on tie score', () => {
        expect(getScheduleResultOutcome('14-14')).toEqual({ home: '', away: '' });
    });

    test('returns empty strings when scores are not numeric', () => {
        expect(getScheduleResultOutcome('TBD-TBD')).toEqual({ home: '', away: '' });
    });

    test('returns empty strings for 0-0 (no game yet)', () => {
        expect(getScheduleResultOutcome('0-0')).toEqual({ home: '', away: '' });
    });

    test('returns empty strings for empty input', () => {
        expect(getScheduleResultOutcome('')).toEqual({ home: '', away: '' });
    });

    test('returns empty strings for "upcoming"', () => {
        expect(getScheduleResultOutcome('upcoming')).toEqual({ home: '', away: '' });
    });

    test('returns empty strings for null', () => {
        expect(getScheduleResultOutcome(null)).toEqual({ home: '', away: '' });
    });

    test('handles a one-sided score (hasPair: false)', () => {
        // A score with no dash: not a valid pair → no outcome
        expect(getScheduleResultOutcome('21')).toEqual({ home: '', away: '' });
    });
});

// ============================================================================
// normalizeLeagueScheduleRow
// ============================================================================

describe('normalizeLeagueScheduleRow', () => {
    test('maps all expected fields from a modern row object', () => {
        const row = {
            week: 'Week 1',
            date: '06/01/2025',
            time: '7:00 PM',
            homeTeam: 'Eagles',
            homeLogo: 'logo.png',
            awayTeam: 'Lions',
            awayLogo: '',
            location: 'Field A',
            status: '21-14'
        };
        expect(normalizeLeagueScheduleRow(row)).toEqual(row);
    });

    test('trims whitespace from every field', () => {
        const row = {
            week: '  Week 2  ',
            date: '  07/01/2025  ',
            time: '  8:00 PM  ',
            homeTeam: '  Team A  ',
            homeLogo: '  logo.jpg  ',
            awayTeam: '  Team B  ',
            awayLogo: '  ',
            location: '  Park  ',
            status: '  7-3  '
        };
        const result = normalizeLeagueScheduleRow(row);
        expect(result.week).toBe('Week 2');
        expect(result.homeTeam).toBe('Team A');
        expect(result.status).toBe('7-3');
    });

    test('falls back to legacy matchup when homeTeam/awayTeam absent', () => {
        const row = { matchup: 'Alpha vs Beta', status: '0-0' };
        const result = normalizeLeagueScheduleRow(row);
        expect(result.homeTeam).toBe('Alpha');
        expect(result.awayTeam).toBe('Beta');
    });

    test('prefers homeTeam/awayTeam over legacy matchup when both present', () => {
        const row = {
            matchup: 'Alpha vs Beta',
            homeTeam: 'Gamma',
            awayTeam: 'Delta',
            status: '0-0'
        };
        const result = normalizeLeagueScheduleRow(row);
        expect(result.homeTeam).toBe('Gamma');
        expect(result.awayTeam).toBe('Delta');
    });

    test('normalizes "upcoming" status to 0-0', () => {
        const result = normalizeLeagueScheduleRow({ status: 'upcoming' });
        expect(result.status).toBe('0-0');
    });

    test('returns empty strings for all fields when given null', () => {
        const result = normalizeLeagueScheduleRow(null);
        expect(result.week).toBe('');
        expect(result.homeTeam).toBe('');
        expect(result.status).toBe('0-0');
    });

    test('returns empty strings for all fields when given {}', () => {
        const result = normalizeLeagueScheduleRow({});
        expect(result).toMatchObject({
            week: '',
            date: '',
            time: '',
            homeTeam: '',
            homeLogo: '',
            awayTeam: '',
            awayLogo: '',
            location: '',
            status: '0-0'
        });
    });
});

// ============================================================================
// getDefaultSeasonLabel
// ============================================================================

describe('getDefaultSeasonLabel', () => {
    const currentYear = new Date().getFullYear();

    test('returns current year label when offset is 0 or omitted', () => {
        expect(getDefaultSeasonLabel(0)).toBe(`${currentYear} Season`);
        expect(getDefaultSeasonLabel()).toBe(`${currentYear} Season`);
    });

    test('adds a positive offset correctly', () => {
        expect(getDefaultSeasonLabel(1)).toBe(`${currentYear + 1} Season`);
        expect(getDefaultSeasonLabel(2)).toBe(`${currentYear + 2} Season`);
    });

    test('handles negative offsets', () => {
        expect(getDefaultSeasonLabel(-1)).toBe(`${currentYear - 1} Season`);
    });
});

// ============================================================================
// getNextSeasonLabel
// ============================================================================

describe('getNextSeasonLabel', () => {
    test('increments the four-digit year in a label', () => {
        expect(getNextSeasonLabel('2025 Season')).toBe('2026 Season');
    });

    test('increments year in multi-word labels', () => {
        expect(getNextSeasonLabel('Summer 2024 Tournament')).toBe('Summer 2025 Tournament');
    });

    test('increments year starting with 19xx', () => {
        expect(getNextSeasonLabel('1999 Season')).toBe('2000 Season');
    });

    test('returns next-year default label when no year found', () => {
        const currentYear = new Date().getFullYear();
        expect(getNextSeasonLabel('No Year Here')).toBe(`${currentYear + 1} Season`);
    });

    test('returns next-year default label for empty string', () => {
        const currentYear = new Date().getFullYear();
        expect(getNextSeasonLabel('')).toBe(`${currentYear + 1} Season`);
    });

    test('returns next-year default label for null', () => {
        const currentYear = new Date().getFullYear();
        expect(getNextSeasonLabel(null)).toBe(`${currentYear + 1} Season`);
    });

    test('only replaces the first matched year when label has multiple years', () => {
        // Both years would match the regex; only the first should be replaced
        const result = getNextSeasonLabel('2024 vs 2024 Season');
        expect(result).toBe('2025 vs 2024 Season');
    });
});

// ============================================================================
// formatArchiveUpdatedAt
// ============================================================================

describe('formatArchiveUpdatedAt', () => {
    test('returns fallback message for null', () => {
        expect(formatArchiveUpdatedAt(null)).toBe('Archive has not been updated yet.');
    });

    test('returns fallback message for undefined', () => {
        expect(formatArchiveUpdatedAt(undefined)).toBe('Archive has not been updated yet.');
    });

    test('returns fallback message for empty string', () => {
        expect(formatArchiveUpdatedAt('')).toBe('Archive has not been updated yet.');
    });

    test('returns fallback message for an invalid date string', () => {
        expect(formatArchiveUpdatedAt('not-a-date')).toBe('Archive has not been updated yet.');
    });

    test('returns a "Last updated:" prefix for a valid ISO timestamp', () => {
        const ts = '2025-06-01T12:00:00.000Z';
        const result = formatArchiveUpdatedAt(ts);
        expect(result).toMatch(/^Last updated:/);
    });

    test('result contains a stringified date component for a valid timestamp', () => {
        const ts = '2025-01-15T00:00:00.000Z';
        const result = formatArchiveUpdatedAt(ts);
        // Locale-formatted string must not be the fallback
        expect(result).not.toBe('Archive has not been updated yet.');
        expect(result.startsWith('Last updated:')).toBe(true);
    });
});

// ============================================================================
// normalizeStatsRow
// ============================================================================

describe('normalizeStatsRow', () => {
    const cols = ['A', 'B', 'C'];

    test('returns matching values for a full row', () => {
        expect(normalizeStatsRow(['x', 'y', 'z'], cols)).toEqual(['x', 'y', 'z']);
    });

    test('fills missing indices with empty string', () => {
        expect(normalizeStatsRow(['x'], cols)).toEqual(['x', '', '']);
    });

    test('handles empty row array', () => {
        expect(normalizeStatsRow([], cols)).toEqual(['', '', '']);
    });

    test('handles null row', () => {
        expect(normalizeStatsRow(null, cols)).toEqual(['', '', '']);
    });

    test('handles undefined row', () => {
        expect(normalizeStatsRow(undefined, cols)).toEqual(['', '', '']);
    });

    test('truncates row to cols length', () => {
        // Row has more entries than cols — only cols.length are returned
        expect(normalizeStatsRow(['a', 'b', 'c', 'd', 'e'], cols)).toEqual(['a', 'b', 'c']);
    });

    test('preserves falsy non-undefined values', () => {
        expect(normalizeStatsRow([0, '', false], cols)).toEqual([0, '', false]);
    });
});

// ============================================================================
// blankLeagueRow
// ============================================================================

describe('blankLeagueRow', () => {
    test('creates an object with all fields set to empty string', () => {
        const fields = [{ key: 'team' }, { key: 'wins' }, { key: 'losses' }];
        expect(blankLeagueRow(fields)).toEqual({ team: '', wins: '', losses: '' });
    });

    test('handles an empty fields array', () => {
        expect(blankLeagueRow([])).toEqual({});
    });
});

// ============================================================================
// cloneRows
// ============================================================================

describe('cloneRows', () => {
    test('returns a new array with shallow copies of each row', () => {
        const original = [{ a: 1 }, { b: 2 }];
        const cloned = cloneRows(original);
        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned[0]).not.toBe(original[0]);
    });

    test('mutation of clone does not affect original', () => {
        const original = [{ name: 'A' }];
        const cloned = cloneRows(original);
        cloned[0].name = 'B';
        expect(original[0].name).toBe('A');
    });

    test('handles empty array', () => {
        expect(cloneRows([])).toEqual([]);
    });
});

// ============================================================================
// getStatsCellValue
// ============================================================================

describe('getStatsCellValue', () => {
    test('returns { type: "number", value: number } for integer strings', () => {
        expect(getStatsCellValue(['Alice', '7'], 1)).toEqual({ type: 'number', value: 7 });
    });

    test('returns { type: "number", value: number } for decimal strings', () => {
        expect(getStatsCellValue(['Alice', '3.5'], 1)).toEqual({ type: 'number', value: 3.5 });
    });

    test('returns { type: "text", value: lowercased } for text values', () => {
        expect(getStatsCellValue(['Alice', 'QB'], 1)).toEqual({ type: 'text', value: 'qb' });
    });

    test('returns empty text for null row', () => {
        expect(getStatsCellValue(null, 0)).toEqual({ type: 'text', value: '' });
    });

    test('returns empty text for missing column index', () => {
        expect(getStatsCellValue(['Alice'], 5)).toEqual({ type: 'text', value: '' });
    });

    test('returns empty text for row[column] === undefined', () => {
        expect(getStatsCellValue([undefined], 0)).toEqual({ type: 'text', value: '' });
    });

    test('returns empty text for empty string value', () => {
        expect(getStatsCellValue([''], 0)).toEqual({ type: 'text', value: '' });
    });

    test('handles negative numbers', () => {
        expect(getStatsCellValue(['-3'], 0)).toEqual({ type: 'number', value: -3 });
    });

    test('treats "0" as a number', () => {
        expect(getStatsCellValue(['0'], 0)).toEqual({ type: 'number', value: 0 });
    });
});

// ============================================================================
// getDefaultStatsSortConfig
// ============================================================================

describe('getDefaultStatsSortConfig', () => {
    test('returns desc column 3 for defensive', () => {
        expect(getDefaultStatsSortConfig('defensive')).toEqual({ column: 3, direction: 'desc' });
    });

    test('returns desc column 3 for recapDefensive', () => {
        expect(getDefaultStatsSortConfig('recapDefensive')).toEqual({ column: 3, direction: 'desc' });
    });

    test('returns desc column 3 for offensive', () => {
        expect(getDefaultStatsSortConfig('offensive')).toEqual({ column: 3, direction: 'desc' });
    });

    test('returns desc column 3 for unknown type', () => {
        expect(getDefaultStatsSortConfig('anything')).toEqual({ column: 3, direction: 'desc' });
    });
});

// ============================================================================
// getSortedStatsRows
// ============================================================================

describe('getSortedStatsRows', () => {
    const makeRows = (...values) => values.map((v) => [v]);

    test('sorts numeric column descending by default (column 0)', () => {
        const data = makeRows(3, 1, 2);
        const config = { column: 0, direction: 'desc' };
        const result = getSortedStatsRows(data, config);
        expect(result.map((r) => r.row[0])).toEqual([3, 2, 1]);
    });

    test('sorts numeric column ascending when direction is "asc"', () => {
        const data = makeRows(3, 1, 2);
        const config = { column: 0, direction: 'asc' };
        const result = getSortedStatsRows(data, config);
        expect(result.map((r) => r.row[0])).toEqual([1, 2, 3]);
    });

    test('sorts text column alphabetically descending', () => {
        const data = [['Charlie'], ['Alice'], ['Bob']];
        const config = { column: 0, direction: 'desc' };
        const result = getSortedStatsRows(data, config);
        expect(result.map((r) => r.row[0])).toEqual(['Charlie', 'Bob', 'Alice']);
    });

    test('sorts text column alphabetically ascending', () => {
        const data = [['Charlie'], ['Alice'], ['Bob']];
        const config = { column: 0, direction: 'asc' };
        const result = getSortedStatsRows(data, config);
        expect(result.map((r) => r.row[0])).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    test('pushes empty/null values to the end regardless of direction', () => {
        const data = [[''], [5], [3]];
        const configDesc = { column: 0, direction: 'desc' };
        const resultDesc = getSortedStatsRows(data, configDesc);
        expect(resultDesc[resultDesc.length - 1].row[0]).toBe('');

        const configAsc = { column: 0, direction: 'asc' };
        const resultAsc = getSortedStatsRows(data, configAsc);
        expect(resultAsc[resultAsc.length - 1].row[0]).toBe('');
    });

    test('empty left value is sorted after non-empty right value (exercises empty-left branch)', () => {
        // Force a sort comparison where left = empty, right = non-empty
        const data = [[''], ['z'], ['a'], ['m']];
        const config = { column: 0, direction: 'asc' };
        const result = getSortedStatsRows(data, config);
        // Empty should be last regardless of direction
        expect(result[result.length - 1].row[0]).toBe('');
        // Non-empty values should be sorted in ascending order before empty
        expect(result[0].row[0]).toBe('a');
    });

    test('preserves original index as a tiebreaker for equal values', () => {
        const data = [[10], [10], [10]];
        const config = { column: 0, direction: 'desc' };
        const result = getSortedStatsRows(data, config);
        expect(result[0].originalIndex).toBe(0);
        expect(result[1].originalIndex).toBe(1);
        expect(result[2].originalIndex).toBe(2);
    });

    test('wraps rows in { row, originalIndex } objects', () => {
        const data = [['Alice', '10'], ['Bob', '20']];
        const config = { column: 1, direction: 'desc' };
        const result = getSortedStatsRows(data, config);
        expect(result[0]).toHaveProperty('row');
        expect(result[0]).toHaveProperty('originalIndex');
    });

    test('falls back to default config { column:3, direction:desc } when no config passed', () => {
        // With column 3 all values are undefined → empty → order preserved
        const data = [['A', 'B', 'C'], ['D', 'E', 'F']];
        const result = getSortedStatsRows(data, undefined);
        // Both values at column 3 are empty so original order is maintained
        expect(result[0].originalIndex).toBe(0);
        expect(result[1].originalIndex).toBe(1);
    });

    test('handles an empty data array', () => {
        expect(getSortedStatsRows([], { column: 0, direction: 'desc' })).toEqual([]);
    });

    test('passes already-wrapped { row, originalIndex } entries through unchanged', () => {
        // Simulate calling getSortedStatsRows a second time on already-wrapped data
        const wrapped = [
            { row: ['B'], originalIndex: 1 },
            { row: ['A'], originalIndex: 0 }
        ];
        const config = { column: 0, direction: 'asc' };
        const result = getSortedStatsRows(wrapped, config);
        // 'A' comes first ascending
        expect(result[0].row[0]).toBe('A');
        expect(result[0].originalIndex).toBe(0);
    });

    test('breaks text ties using originalIndex when localeCompare returns 0', () => {
        // Two rows with values that compare as equal text
        const data = [['same'], ['same'], ['same']];
        const config = { column: 0, direction: 'asc' };
        const result = getSortedStatsRows(data, config);
        // Original order should be preserved when all values are identical
        expect(result[0].originalIndex).toBe(0);
        expect(result[1].originalIndex).toBe(1);
        expect(result[2].originalIndex).toBe(2);
    });
});

// ============================================================================
// findMatchingAdminAccount
// ============================================================================

describe('findMatchingAdminAccount', () => {
    const accounts = [
        { username: 'admin1', password: 'pass1' },
        { username: 'admin2', password: 'pass2' }
    ];

    test('returns matching account for correct credentials', () => {
        expect(findMatchingAdminAccount(accounts, 'admin1', 'pass1')).toEqual({
            username: 'admin1',
            password: 'pass1'
        });
    });

    test('returns null for wrong password', () => {
        expect(findMatchingAdminAccount(accounts, 'admin1', 'wrong')).toBeNull();
    });

    test('returns null for wrong username', () => {
        expect(findMatchingAdminAccount(accounts, 'nobody', 'pass1')).toBeNull();
    });

    test('returns null for completely wrong credentials', () => {
        expect(findMatchingAdminAccount(accounts, 'x', 'y')).toBeNull();
    });

    test('is case-sensitive for username', () => {
        expect(findMatchingAdminAccount(accounts, 'Admin1', 'pass1')).toBeNull();
    });

    test('is case-sensitive for password', () => {
        expect(findMatchingAdminAccount(accounts, 'admin1', 'Pass1')).toBeNull();
    });

    test('returns null for null accounts list', () => {
        expect(findMatchingAdminAccount(null, 'admin1', 'pass1')).toBeNull();
    });

    test('returns null for empty accounts list', () => {
        expect(findMatchingAdminAccount([], 'admin1', 'pass1')).toBeNull();
    });

    test('returns second account when first does not match', () => {
        expect(findMatchingAdminAccount(accounts, 'admin2', 'pass2')).toEqual({
            username: 'admin2',
            password: 'pass2'
        });
    });
});
