// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/content/selectors.js', () => ({
  gidForSheetName: vi.fn(),
  nameBox: vi.fn(),
  tabElementForName: vi.fn(() => null),
}));

const rebuildNameBox = (value = 'B12') => {
  document.body.innerHTML = '';
  const input = document.createElement('input');
  input.value = value;
  document.body.appendChild(input);
  return input;
};

/** Fresh module state per test — the back stack is module-level. */
async function freshModules(nameBoxValue = 'B12') {
  vi.resetModules();
  const sheets = await import('../src/content/selectors.js');
  const navigate = await import('../src/content/navigate.js');
  const input = rebuildNameBox(nameBoxValue);
  sheets.nameBox.mockReturnValue(input);
  sheets.gidForSheetName.mockReturnValue(null);
  sheets.tabElementForName.mockReturnValue(null);
  return { sheets, navigate, input };
}

beforeEach(() => {
  location.hash = '';
});

describe('jumpTo — hash strategy', () => {
  it('navigates by gid when the sheet has a visible tab', async () => {
    const { sheets, navigate } = await freshModules();
    sheets.gidForSheetName.mockReturnValue('1234567890');

    const result = navigate.jumpTo({ sheet: 'Q3 Forecast', range: 'E40' });

    expect(result).toMatchObject({ ok: true, strategy: 'hash' });
    expect(location.hash).toBe('#gid=1234567890&range=E40');
    expect(sheets.gidForSheetName).toHaveBeenCalledWith('Q3 Forecast');
  });

  it('leaves the colon unencoded in a range', async () => {
    const { sheets, navigate } = await freshModules();
    sheets.gidForSheetName.mockReturnValue('42');

    navigate.jumpTo({ sheet: 'Summary', range: 'A1:A20' });
    expect(location.hash).toBe('#gid=42&range=A1:A20');
  });

  it('re-fires a jump to the cell we are already on', async () => {
    const { sheets, navigate } = await freshModules();
    sheets.gidForSheetName.mockReturnValue('7');
    location.hash = '#gid=7&range=E40';

    // Without the clear-first guard this would set an identical hash, fire no
    // hashchange, and silently do nothing.
    navigate.jumpTo({ sheet: 'Q3 Forecast', range: 'E40' });
    expect(location.hash).toBe('#gid=7&range=E40');
  });
});

describe('jumpTo — name box fallback', () => {
  it('falls back when the sheet has no tab (hidden sheet)', async () => {
    const { navigate, input } = await freshModules();
    // gidForSheetName returns null by default here.
    const result = navigate.jumpTo({ sheet: 'Hidden Sheet', range: 'C3' });

    expect(result).toMatchObject({ ok: true, strategy: 'nameBox' });
    expect(input.value).toBe("'Hidden Sheet'!C3");
    expect(location.hash).toBe(''); // did not use hash navigation
  });

  it('quotes a sheet name that needs it', async () => {
    const { navigate, input } = await freshModules();
    navigate.jumpTo({ sheet: "Bob's Budget", range: 'A1' });
    expect(input.value).toBe("'Bob''s Budget'!A1");
  });

  it('uses the name box for a same-sheet reference', async () => {
    const { navigate, input } = await freshModules();
    const result = navigate.jumpTo({ sheet: null, range: 'Z99' });

    expect(result).toMatchObject({ ok: true, strategy: 'nameBox' });
    expect(input.value).toBe('Z99');
  });

  it('reports failure when the name box cannot be found', async () => {
    const { sheets, navigate } = await freshModules();
    sheets.nameBox.mockReturnValue(null);

    const result = navigate.jumpTo({ sheet: 'Hidden', range: 'A1' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Hidden');
  });

  it('dispatches an Enter key to commit the name box', async () => {
    const { navigate, input } = await freshModules();
    const keys = [];
    for (const type of ['keydown', 'keyup']) {
      input.addEventListener(type, (e) => keys.push(`${type}:${e.key}`));
    }

    navigate.jumpTo({ sheet: null, range: 'A1' });
    expect(keys).toContain('keydown:Enter');
    expect(keys).toContain('keyup:Enter');
  });
});

describe('jumpTo — tab click, when the gid is unknown', () => {
  /**
   * The live case: tab names resolve but no tab exposes a gid, so hash
   * navigation has nothing to work with. Clicking the tab makes Sheets switch
   * and write the gid into the URL, which we then read and reuse.
   */
  function mountTab(onClick) {
    const tab = document.createElement('div');
    tab.className = 'docs-sheet-tab';
    tab.addEventListener('mousedown', onClick);
    document.body.appendChild(tab);
    return tab;
  }

  it('clicks the tab, then positions using the gid Sheets puts in the URL', async () => {
    vi.useFakeTimers();
    try {
      const { sheets, navigate } = await freshModules();
      location.hash = '#gid=111';
      // Simulate Sheets switching sheets in response to the click.
      const tab = mountTab(() => { location.hash = '#gid=555'; });
      sheets.tabElementForName.mockReturnValue(tab);

      const result = navigate.jumpTo({ sheet: 'Pricing Detail', range: 'A2' });
      expect(result).toMatchObject({ ok: true, strategy: 'tabClick' });

      await vi.advanceTimersByTimeAsync(200);
      expect(location.hash).toBe('#gid=555&range=A2');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reuses the learned gid on the next jump, skipping the click', async () => {
    vi.useFakeTimers();
    try {
      const { sheets, navigate } = await freshModules();
      location.hash = '#gid=111';
      let clicks = 0;
      const tab = mountTab(() => { clicks += 1; location.hash = '#gid=555'; });
      sheets.tabElementForName.mockReturnValue(tab);

      navigate.jumpTo({ sheet: 'Q3 Forecast', range: 'A2' });
      await vi.advanceTimersByTimeAsync(200);
      expect(clicks).toBe(1);

      // Second jump to the same sheet should go straight down the hash route.
      const second = navigate.jumpTo({ sheet: 'Q3 Forecast', range: 'E40' });
      expect(second).toMatchObject({ ok: true, strategy: 'hash' });
      expect(clicks).toBe(1); // no second click
      expect(location.hash).toBe('#gid=555&range=E40');
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to the name box if the tab click never changes the URL', async () => {
    vi.useFakeTimers();
    try {
      const { sheets, navigate, input } = await freshModules();
      location.hash = '#gid=111';
      const tab = mountTab(() => {}); // an unresponsive tab
      sheets.tabElementForName.mockReturnValue(tab);

      navigate.jumpTo({ sheet: 'Hidden', range: 'C3' });
      await vi.advanceTimersByTimeAsync(2000);

      expect(input.value).toBe('Hidden!C3');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('jumpTo — guards', () => {
  it('rejects an empty reference', async () => {
    const { navigate } = await freshModules();
    expect(navigate.jumpTo(null).ok).toBe(false);
    expect(navigate.jumpTo({ sheet: 'X', range: '' }).ok).toBe(false);
  });
});

describe('jump back', () => {
  it('returns to the cell we jumped from', async () => {
    const { sheets, navigate } = await freshModules('B12');
    sheets.gidForSheetName.mockReturnValue('999');
    location.hash = '#gid=111';

    navigate.jumpTo({ sheet: 'Q3 Forecast', range: 'E40' });
    expect(location.hash).toBe('#gid=999&range=E40');

    const back = navigate.jumpBack();
    expect(back.ok).toBe(true);
    expect(location.hash).toBe('#gid=111&range=B12');
  });

  it('walks a chain of jumps in reverse', async () => {
    const { sheets, navigate, input } = await freshModules('A1');
    sheets.gidForSheetName.mockImplementation((name) => ({ One: '1', Two: '2', Three: '3' }[name]));

    location.hash = '#gid=1';
    navigate.jumpTo({ sheet: 'Two', range: 'B2' });
    expect(navigate.backStackDepth()).toBe(1);

    input.value = 'B2';
    navigate.jumpTo({ sheet: 'Three', range: 'C3' });
    expect(navigate.backStackDepth()).toBe(2);

    navigate.jumpBack();
    expect(location.hash).toBe('#gid=2&range=B2');
    navigate.jumpBack();
    expect(location.hash).toBe('#gid=1&range=A1');
    expect(navigate.backStackDepth()).toBe(0);
  });

  it('reports when there is nothing to go back to', async () => {
    const { navigate } = await freshModules();
    const result = navigate.jumpBack();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/nothing/i);
  });
});
