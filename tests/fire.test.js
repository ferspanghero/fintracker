import { describe, it, expect } from 'vitest';
import { buildFire, recentFlows, defaultProjectionYears } from '../js/fire.js';
import { emptySettings, addAsset, setHoldingSplit, setTargets } from '../js/settings.js';

const TODAY = new Date(2026, 9, 17);
const R = (1.07 / 1.02) - 1;

// Settings with one asset per [id, type, holding, currency]; holdings get the given splits.
function settingsWith(assets, splits = {}) {
    const settings = emptySettings();
    settings.rates.USD = 1.5;
    assets.forEach(([id, type, holding, currency = 'CAD']) => addAsset(settings, id, currency, () => id, { type, owner: id, holding }));
    Object.entries(splits).forEach(([holding, split]) => setHoldingSplit(settings, holding, split));

    return settings;
}

const monthly = (year, month, income, expenses) => [
    { date: new Date(year, month - 1, 5), description: 'Pay', amount: income, type: 'income', category: 'Trabalho', account: 'Bank' },
    { date: new Date(year, month - 1, 6), description: 'Rent', amount: expenses, type: 'expense', category: 'Casa', account: 'Bank' }
];

// Twelve months up to Sep 2026 with 10,000 in and 5,000 out each: 60,000 spent and 60,000 saved.
const lastYear = () => Array.from({ length: 12 }, (_, i) => monthly(2025 + Math.floor((9 + i) / 12), ((9 + i) % 12) + 1, 10000, 5000)).flat();

function standard(overrides = {}) {
    const settings = settingsWith(
        [['eq', 'Non-registered', 'ETF1'], ['cash', 'Savings', 'Cash']],
        { ETF1: { usEquity: 100 }, Cash: { cash: 100 } }
    );

    return {
        transactions: lastYear(),
        balances: { '2026-09': { eq: 1200000, cash: 50000 } },
        closedMonths: [],
        settings,
        today: TODAY,
        ...overrides
    };
}

describe('buildFire — where you stand', () => {
    it('has nothing to show without balances', () => {
        // Act, Assert
        expect(buildFire({ ...standard(), balances: {} })).toEqual({ latestMonth: null });
    });

    it('computes the FI portfolio, FI number and SWR today from the latest month and last 12 months', () => {
        // Act
        const fire = buildFire(standard());

        // Assert
        expect(fire.latestMonth).toBe('2026-09');
        expect(fire.fiPortfolio).toBe(1200000);
        expect(fire.spending).toBe(60000);
        expect(fire.saved).toBe(60000);
        expect(fire.withdrawal).toBeCloseTo(75000);
        expect(fire.fiNumber).toBeCloseTo(1875000);
        expect(fire.swrToday).toBeCloseTo(0.0625);
    });

    it('shows progress as share achieved, freedom days and the last day of the year already paid for', () => {
        // Act
        const fire = buildFire(standard());

        // Assert
        expect(fire.achieved).toBeCloseTo(0.64);
        expect(fire.freedomDays).toBe(233);
        expect(fire.freedomLastDay).toEqual(new Date(2026, 7, 21));
        expect(fire.stillToFund).toBeCloseTo(675000);
    });

    it('uses the retirement spending override instead of the last 12 months when set', () => {
        // Arrange
        const input = standard();
        input.settings.fire.retirementSpending = 40000;

        // Act
        const fire = buildFire(input);

        // Assert
        expect(fire.spending).toBe(40000);
        expect(fire.defaultSpending).toBe(60000);
        expect(fire.spendingIsDefault).toBe(false);
        expect(fire.fiNumber).toBeCloseTo(1250000);
        expect(fire.saved).toBe(60000);
    });

    it('marks the last 12 months as the spending in use without an override', () => {
        // Act
        const fire = buildFire(standard());

        // Assert
        expect(fire).toMatchObject({ spending: 60000, defaultSpending: 60000, spendingIsDefault: true });
    });

    it('has no FI number when the override is 0', () => {
        // Arrange
        const input = standard();
        input.settings.fire.retirementSpending = 0;

        // Act, Assert
        expect(buildFire(input).fiNumber).toBeNull();
    });

    it('only counts transactions from the 12 months ending at the latest month', () => {
        // Arrange
        const input = standard();
        input.transactions.push(...monthly(2025, 9, 99999, 99999), ...monthly(2026, 10, 99999, 99999));

        // Act, Assert
        expect(buildFire(input).spending).toBe(60000);
    });

    it('has no FI number and no projection without spending', () => {
        // Act
        const fire = buildFire(standard({ transactions: [] }));

        // Assert
        expect(fire).toMatchObject({ fiNumber: null, swrToday: null, achieved: null, freedomDays: null, freedomLastDay: null, stillToFund: null, fiYear: null, projection: null });
        expect(fire.fiPortfolio).toBe(1200000);
    });

    it('stops at the missing rates when the latest month needs one', () => {
        // Arrange
        const input = standard();
        input.settings.rates.USD = null;
        addAsset(input.settings, 'usd', 'USD', () => 'usd');
        input.balances['2026-09'].usd = 10;

        // Act, Assert
        expect(buildFire(input)).toEqual({ latestMonth: '2026-09', missingRates: ['USD'] });
    });

    it('leaves out only the cash share of each holding and counts unclassified assets in full', () => {
        // Arrange
        const settings = settingsWith(
            [['mix', 'RRSP', 'Balanced', 'USD'], ['plain', null, ''], ['bank', 'Chequing', 'Cash']],
            { Balanced: { usEquity: 80, cash: 20 }, Cash: { cash: 100 } }
        );

        // Act
        const fire = buildFire(standard({ settings, balances: { '2026-09': { mix: 1000, plain: 500, bank: 300 } } }));

        // Assert
        expect(fire.fiPortfolio).toBeCloseTo(1000 * 1.5 * 0.8 + 500);
    });

    it('works out the non-registered share of the FI portfolio from the account types', () => {
        // Arrange
        const settings = settingsWith([['taxed', 'Non-registered', ''], ['tfsa', 'TFSA', '']]);

        // Act
        const fire = buildFire(standard({ settings, balances: { '2026-09': { taxed: 500, tfsa: 500 } } }));

        // Assert
        expect(fire.nonRegShare).toBe(0.5);
    });

    it('has a zero non-registered share when the FI portfolio is negative', () => {
        // Arrange
        const settings = settingsWith([['taxed', 'Non-registered', ''], ['tfsa', 'TFSA', '']]);

        // Act, Assert
        expect(buildFire(standard({ settings, balances: { '2026-09': { taxed: 500, tfsa: -1000 } } })).nonRegShare).toBe(0);
    });

    it('has a zero non-registered share when the FI portfolio is empty', () => {
        // Act, Assert
        expect(buildFire(standard({ balances: { '2026-09': { cash: 100 } } })).nonRegShare).toBe(0);
    });

    it('shows a whole year paid for once the FI number is reached', () => {
        // Act
        const fire = buildFire(standard({ balances: { '2026-09': { eq: 3000000 } } }));

        // Assert
        expect(fire.achieved).toBeCloseTo(1.6);
        expect(fire.freedomDays).toBe(365);
        expect(fire.freedomLastDay).toEqual(new Date(2026, 11, 31));
        expect(fire.stillToFund).toBe(0);
        expect(fire.fiYear).toBe('reached');
    });

    it('covers no days when the FI portfolio is negative', () => {
        // Act
        const fire = buildFire(standard({ balances: { '2026-09': { eq: -5000 } } }));

        // Assert
        expect(fire.freedomDays).toBe(0);
        expect(fire.freedomLastDay).toBeNull();
        expect(fire.swrToday).toBeNull();
    });

    it('has no paid-for day when no day is covered', () => {
        // Act
        const fire = buildFire(standard({ balances: { '2026-09': { eq: 1000 } } }));

        // Assert
        expect(fire.freedomDays).toBe(0);
        expect(fire.freedomLastDay).toBeNull();
    });
});

describe('buildFire — projection', () => {
    const projectionInput = () => {
        const input = standard();
        Object.assign(input.settings.fire, { birthYear: 1990, projectionStart: 2026, projectionEnd: 2033 });

        return input;
    };
    const rowFor = (fire, year) => fire.projection.find(row => row.year === year);

    it('projects the rest of the open year from the latest month', () => {
        // Act
        const open = rowFor(buildFire(projectionInput()), 2026);

        // Assert
        expect(open.kind).toBe('open');
        expect(open.age).toBe(36);
        expect(open.start).toBe(1200000);
        expect(open.taxDrag).toBeCloseTo(1200000 * (0.07 * 0.1 / 1.02) * 0.25);
        expect(open.end).toBeCloseTo(1200000 + 1200000 * R * 0.25 - open.taxDrag + 15000);
        expect(open.end).toBeCloseTo(1227647.06, 1);
        expect(open.change).toBeCloseTo(open.end - 1200000);
        expect(open.swr).toBeCloseTo(75000 / 1227647.06);
    });

    it('chains projected years until the end year and marks the first one at the FI number', () => {
        // Act
        const fire = buildFire(projectionInput());

        // Assert
        expect(fire.projection.map(row => row.year)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]);
        expect(rowFor(fire, 2027)).toMatchObject({ kind: 'projected', start: rowFor(fire, 2026).end });
        expect(rowFor(fire, 2027).change).toBeCloseTo(rowFor(fire, 2027).start * R - rowFor(fire, 2027).taxDrag + 60000);
        expect(rowFor(fire, 2027).end).toBeCloseTo(1339400.81, 1);
        expect(rowFor(fire, 2031).end).toBeCloseTo(1835555.98, 1);
        expect(rowFor(fire, 2032).end).toBeCloseTo(1972937.26, 1);
        expect(fire.projection.filter(row => row.fi).map(row => row.year)).toEqual([2032]);
        expect(fire.fiYear).toBe(2032);
        expect(fire.fiAge).toBe(42);
        expect(fire.projectionEnd).toBe(2033);
    });

    it('reports FI as not reached when the end year comes first', () => {
        // Arrange
        const input = projectionInput();
        input.settings.fire.projectionEnd = 2030;

        // Act
        const fire = buildFire(input);

        // Assert
        expect(fire.fiYear).toBeNull();
        expect(fire.fiAge).toBeNull();
        expect(fire.projection.some(row => row.fi)).toBe(false);
    });

    it('shows closed Decembers as actual years with how much the FI portfolio changed', () => {
        // Arrange
        const input = projectionInput();
        input.settings.fire.projectionStart = 2023;
        Object.assign(input.balances, { '2023-12': { eq: 700000 }, '2024-12': { eq: 800000 }, '2025-12': { eq: 1000000 } });
        input.closedMonths.push('2024-12', '2025-12');
        input.transactions.push(...monthly(2025, 1, 50000, 20000));

        // Act
        const fire = buildFire(input);

        // Assert
        expect(rowFor(fire, 2023)).toEqual({ year: 2023, kind: 'none', age: 33, start: null, change: null, taxDrag: null, end: null, swr: null, fi: false });
        expect(rowFor(fire, 2024)).toMatchObject({ kind: 'actual', start: null, end: 800000, change: null, taxDrag: null });
        expect(rowFor(fire, 2025)).toMatchObject({ kind: 'actual', start: 800000, end: 1000000, change: 200000, taxDrag: null });
        expect(rowFor(fire, 2025).swr).toBeCloseTo(75000 / 1000000);
    });

    it('starts the projection the next year when the latest month is a closed December', () => {
        // Arrange
        const input = projectionInput();
        input.balances = { '2025-12': { eq: 1200000 } };
        input.closedMonths.push('2025-12');
        input.transactions = lastYear().map(t => ({ ...t, date: new Date(t.date.getFullYear() - 1, t.date.getMonth() + 3, 5) }));
        input.settings.fire.projectionStart = 2025;

        // Act
        const fire = buildFire(input);

        // Assert
        expect(rowFor(fire, 2025)).toMatchObject({ kind: 'actual', end: 1200000 });
        expect(rowFor(fire, 2026)).toMatchObject({ kind: 'projected', start: 1200000 });
        expect(rowFor(fire, 2026).change).toBeCloseTo(1200000 * R - rowFor(fire, 2026).taxDrag + 60000);
    });

    it('keeps an open December with nothing left to project', () => {
        // Arrange
        const input = projectionInput();
        input.balances = { '2025-12': { eq: 1200000 } };
        input.settings.fire.projectionStart = 2025;

        // Act
        const open = rowFor(buildFire(input), 2025);

        // Assert
        expect(open).toMatchObject({ kind: 'open', start: 1200000, change: 0, taxDrag: 0, end: 1200000 });
    });

    it('still projects from the latest month when the projection starts later', () => {
        // Arrange
        const input = projectionInput();
        input.settings.fire.projectionStart = 2028;

        // Act
        const fire = buildFire(input);

        // Assert
        expect(fire.projection[0].year).toBe(2028);
        expect(fire.projection[0].end).toBeCloseTo(1455865.74, 1);
    });

    it('finds the FI year even when the projection starts after it', () => {
        // Arrange
        const input = projectionInput();
        input.settings.fire.projectionStart = 2033;
        input.settings.fire.projectionEnd = 2035;

        // Act
        const fire = buildFire(input);

        // Assert
        expect(fire.fiYear).toBe(2032);
        expect(fire.projection.map(row => row.year)).toEqual([2033, 2034, 2035]);
    });

    it('never turns the tax drag into a gain when the expected return is negative', () => {
        // Arrange
        const input = projectionInput();
        input.settings.fire.expectedReturn = -2;

        // Act
        const open = rowFor(buildFire(input), 2026);

        // Assert
        expect(open.taxDrag).toBe(0);
    });

    it('defaults to the first year with balances through 20 years from now, without ages', () => {
        // Arrange
        const input = standard();
        input.balances['2024-03'] = { eq: 1 };

        // Act
        const fire = buildFire(input);

        // Assert
        expect(fire.projection[0].year).toBe(2024);
        expect(fire.projection.at(-1).year).toBe(2046);
        expect(fire.projection[0].age).toBeNull();
    });

    it('marks FI as reached instead of a year when the portfolio is already there', () => {
        // Arrange
        const input = projectionInput();
        input.balances['2026-09'].eq = 3000000;

        // Act
        const fire = buildFire(input);

        // Assert
        expect(fire.fiYear).toBe('reached');
        expect(fire.projection.some(row => row.fi)).toBe(false);
    });

    it('leaves an actual year blank when its rates are missing', () => {
        // Arrange
        const input = projectionInput();
        input.settings.fire.projectionStart = 2025;
        addAsset(input.settings, 'usd', 'USD', () => 'usd');
        input.settings.rates.USD = null;
        input.balances['2025-12'] = { usd: 5 };
        input.closedMonths.push('2025-12');

        // Act
        const fire = buildFire(input);

        // Assert
        expect(rowFor(fire, 2025)).toMatchObject({ kind: 'actual', end: null, swr: null });
        expect(rowFor(fire, 2026).start).toBe(1200000);
    });
});

describe('buildFire — allocation and holdings', () => {
    function allocationInput() {
        const settings = settingsWith(
            [['eq', 'TFSA', 'ETF1'], ['ca', 'RRSP', 'CA'], ['home', 'Real estate', ''], ['old', 'Stocks', 'X']],
            { ETF1: { usEquity: 60, intlEquity: 40 }, CA: { canadaEquity: 100 } }
        );
        settings.assets.find(a => a.id === 'old').archived = true;

        return standard({ settings, balances: { '2026-09': { eq: 1000, ca: 1000, home: 500 } } });
    }

    it('spreads each classified asset by its split and puts the rest in Unclassified', () => {
        // Act
        const { allocation } = buildFire(allocationInput());

        // Assert
        expect(allocation.total).toBe(2000);
        expect(allocation.unclassified).toBe(500);
        expect(allocation.rows.map(row => [row.key, row.value, row.share])).toEqual([
            ['fixedIncome', 0, 0], ['canadaEquity', 1000, 0.5], ['usEquity', 600, 0.3], ['intlEquity', 400, 0.2],
            ['emEquity', 0, 0], ['realEstate', 0, 0], ['cash', 0, 0]
        ]);
        expect(allocation.hasTargets).toBe(false);
        expect(allocation.rows[1]).toMatchObject({ target: null, drift: null, toTarget: null });
    });

    it('shows drift from the targets and how much to buy or sell', () => {
        // Arrange
        const input = allocationInput();
        setTargets(input.settings, { canadaEquity: 40, usEquity: 40, intlEquity: 20 });

        // Act
        const { allocation } = buildFire(input);
        const row = key => allocation.rows.find(r => r.key === key);

        // Assert
        expect(allocation.hasTargets).toBe(true);
        expect(row('canadaEquity')).toMatchObject({ target: 0.4, toTarget: -200 });
        expect(row('canadaEquity').drift).toBeCloseTo(0.1);
        expect(row('usEquity').toTarget).toBeCloseTo(200);
        expect(row('intlEquity').toTarget).toBeCloseTo(0);
        expect(row('cash')).toMatchObject({ target: null, drift: null, toTarget: null, share: null });
    });

    it('leaves classes without a target out of the percentages but counts a 0% target', () => {
        // Arrange
        const input = allocationInput();
        input.settings.holdings.push({ name: 'Home', split: { realEstate: 100 } });
        input.settings.assets.find(a => a.id === 'home').holding = 'Home';
        setTargets(input.settings, { usEquity: 100, canadaEquity: 0 });

        // Act
        const { allocation } = buildFire(input);
        const row = key => allocation.rows.find(r => r.key === key);

        // Assert
        expect(allocation.total).toBe(1600);
        expect(row('usEquity')).toMatchObject({ value: 600, target: 1, toTarget: 1000 });
        expect(row('usEquity').share).toBeCloseTo(0.375);
        expect(row('canadaEquity')).toMatchObject({ value: 1000, target: 0, toTarget: -1000 });
        expect(row('canadaEquity').drift).toBeCloseTo(0.625);
        expect(row('realEstate')).toMatchObject({ value: 500, share: null, target: null, drift: null, toTarget: null });
        expect(row('intlEquity')).toMatchObject({ value: 400, share: null });
    });

    it('has no buy or sell amounts while nothing is held in the targeted classes', () => {
        // Arrange
        const input = allocationInput();
        setTargets(input.settings, { fixedIncome: 100 });

        // Act
        const { allocation } = buildFire(input);
        const bonds = allocation.rows.find(r => r.key === 'fixedIncome');

        // Assert
        expect(allocation.total).toBe(0);
        expect(bonds).toMatchObject({ value: 0, share: null, target: 1, drift: null, toTarget: null });
    });

    it('has no shares when nothing is classified', () => {
        // Act
        const { allocation } = buildFire(standard({ settings: settingsWith([['plain', null, '']]), balances: { '2026-09': { plain: 10 } } }));

        // Assert
        expect(allocation.total).toBe(0);
        expect(allocation.rows[0].share).toBeNull();
    });

    it('lists the latest month\'s holdings largest first, archived ones included', () => {
        // Arrange
        const input = allocationInput();
        input.balances['2026-09'].old = 2000;

        // Act
        const { holdings } = buildFire(input);

        // Assert
        expect(holdings.map(h => [h.asset.id, h.value, h.split])).toEqual([
            ['old', 2000, undefined],
            ['eq', 1000, { usEquity: 60, intlEquity: 40 }],
            ['ca', 1000, { canadaEquity: 100 }],
            ['home', 500, undefined]
        ]);
    });
});

describe('recentFlows', () => {
    it('sums the 12 months ending at the latest month with balances', () => {
        // Act
        const flows = recentFlows(standard());

        // Assert
        expect(flows).toEqual({ firstMonth: '2025-10', latestMonth: '2026-09', spending: 60000, saved: 60000 });
    });

    it('has nothing to sum without balances', () => {
        // Act, Assert
        expect(recentFlows(standard({ balances: {} }))).toBeNull();
    });
});

describe('defaultProjectionYears', () => {
    it('runs from the first year with balances through 20 years from now', () => {
        // Arrange
        const input = standard();
        input.balances['2023-05'] = { eq: 1 };

        // Act, Assert
        expect(defaultProjectionYears(input)).toEqual({ start: 2023, end: 2046 });
    });

    it('starts this year without balances', () => {
        // Act, Assert
        expect(defaultProjectionYears(standard({ balances: {} }))).toEqual({ start: 2026, end: 2046 });
    });
});
