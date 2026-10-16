import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createMemoryStore } from './data/memoryStore';
import { AuthContext, type AuthValue } from './state/AuthContext';
import { EventsProvider } from './state/EventsContext';
import { eventDetails } from './test/fixtures';
import type { RecordEvent } from './types';

const USER_ID = 'user-1';

function TestAuth({ value, children }: { value: Partial<AuthValue>; children: ReactNode }) {
  const auth: AuthValue = {
    status: 'signed-in',
    userId: USER_ID,
    email: 'pat@example.com',
    role: 'organizer',
    displayName: 'Pat Organizer',
    signIn: async () => null,
    signOut: async () => {},
    ...value,
  };
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

/** Renders the app signed in (by default) against an in-memory store. */
function renderApp(path = '/', { auth = {}, events = [] }: { auth?: Partial<AuthValue>; events?: RecordEvent[] } = {}) {
  const store = createMemoryStore(auth.userId ?? USER_ID, events);
  render(
    <MemoryRouter initialEntries={[path]}>
      <TestAuth value={auth}>
        <EventsProvider store={store}>
          <App />
        </EventsProvider>
      </TestAuth>
    </MemoryRouter>,
  );
  return store;
}

async function createEvent(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('link', { name: 'Create your first event' }));

  await user.type(screen.getByLabelText(/Event name/), 'Perris Vertical Record');
  await user.type(screen.getByLabelText(/Start date/), '2026-10-10');
  await user.type(screen.getByLabelText(/End date/), '2026-10-12');
  await user.type(screen.getByLabelText(/Drop zone/), 'Skydive Perris');
  await user.type(screen.getByLabelText(/City/), 'Perris');
  await user.selectOptions(screen.getByLabelText(/State/), 'CA');
  const organizer = screen.getByRole('heading', { name: 'Organizer' }).closest('section')!;
  // Organizer name is prefilled from the signed-in user.
  expect(within(organizer).getByLabelText(/Organizer name/)).toHaveValue('Pat Organizer');
  await user.type(within(organizer).getByLabelText('Phone'), '555-0100');
  await user.click(screen.getByRole('button', { name: 'Create event' }));
  await screen.findByRole('heading', { name: 'Perris Vertical Record' });
}

async function addSkydiver(
  user: ReturnType<typeof userEvent.setup>,
  { name, id, license = 'D-1', exp = '2027-01-01' }: { name: string; id: string; license?: string; exp?: string },
) {
  const dialog = screen.getByRole('dialog');
  const [first, last] = name.split(' ');
  await user.type(within(dialog).getByLabelText(/First name/), first);
  await user.type(within(dialog).getByLabelText(/Last name/), last);
  await user.type(within(dialog).getByLabelText(/USPA membership ID/), id);
  await user.type(within(dialog).getByLabelText(/USPA license number/), license);
  await user.type(within(dialog).getByLabelText(/Membership expiration/), exp);
}

describe('App', () => {
  it('shows the login screen when signed out, with no sign-up or password reset', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValueOnce('Incorrect email or password.').mockResolvedValue(null);
    renderApp('/', { auth: { status: 'signed-out', signIn } });
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText(/sign up|create account/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'pat@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(signIn).toHaveBeenCalledWith('pat@example.com', 'wrong');
  });

  it('tells signed-in users without a role that they have no access', () => {
    renderApp('/', { auth: { status: 'no-role', role: null } });
    expect(screen.getByRole('heading', { name: 'No access yet' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /New event/ })).not.toBeInTheDocument();
  });

  it('shows the user and a sign-out button', async () => {
    const user = userEvent.setup();
    const signOut = vi.fn().mockResolvedValue(undefined);
    renderApp('/', { auth: { signOut } });
    expect(screen.getByText('Pat Organizer')).toBeInTheDocument();
    expect(screen.getByText('organizer')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalled();
  });

  it('creates an event, builds a pool sorted by name, flags expired memberships, and blocks duplicates', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await createEvent(user);

    expect(screen.getByRole('heading', { name: 'Perris Vertical Record' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Add skydiver' }));
    expect(screen.getByTestId('jumper-number')).toHaveTextContent('#1');
    await addSkydiver(user, { name: 'Zoe Zephyr', id: '200', exp: '2026-01-01' });
    // Warning preview shows but does not block saving.
    expect(within(screen.getByRole('dialog')).getByText('Expired')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save & add another' }));

    expect(screen.getByTestId('jumper-number')).toHaveTextContent('#2');
    await addSkydiver(user, { name: 'Alex Aero', id: '100' });
    await user.click(screen.getByRole('button', { name: 'Save & add another' }));

    // Duplicate membership ID is rejected.
    await addSkydiver(user, { name: 'Copy Cat', id: '100' });
    await user.click(screen.getByRole('button', { name: 'Add skydiver' }));
    expect(screen.getByText(/Already in this event as #2 Alex Aero/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    // Sorted by first name, shown in First / Last columns.
    expect(within(rows[0]).getAllByRole('cell').map((c) => c.textContent).slice(0, 3)).toEqual(['2', 'Alex', 'Aero']);
    expect(within(rows[1]).getAllByRole('cell').map((c) => c.textContent).slice(0, 3)).toEqual(['1', 'Zoe', 'Zephyr']);
    expect(within(rows[1]).getByText('Expired')).toBeInTheDocument();

    const stored = store.snapshot();
    expect(stored[0].skydivers).toHaveLength(2);
  });

  it('creates a State record with skydivers picked from the pool', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await createEvent(user);

    await user.click(screen.getByRole('button', { name: '+ Add skydiver' }));
    await addSkydiver(user, { name: 'Zoe Zephyr', id: '200' });
    await user.click(screen.getByRole('button', { name: 'Save & add another' }));
    await addSkydiver(user, { name: 'Alex Aero', id: '100' });
    await user.click(screen.getByRole('button', { name: 'Add skydiver' }));

    await user.click(screen.getByRole('link', { name: '+ New record' }));

    // State dropdown only appears for the State zone, prefilled with the event's state.
    expect(screen.queryByLabelText(/^State/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Zone/), 'state');
    expect(screen.getByLabelText(/^State/)).toHaveValue('CA');

    // Clearing the state blocks saving.
    await user.selectOptions(screen.getByLabelText(/^State/), '');
    await user.selectOptions(screen.getByLabelText(/Type/), 'ws-seq-lf-nogrip-vertical');
    await user.click(screen.getByRole('button', { name: 'Create record' }));
    expect(screen.getByText('Select a state')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^State/), 'NV');
    // Attempt date defaults to the event start and is limited to the event dates.
    const attempt = screen.getByLabelText(/Record attempt date/);
    expect(attempt).toHaveValue('2026-10-10');
    expect(attempt).toHaveAttribute('min', '2026-10-10');
    expect(attempt).toHaveAttribute('max', '2026-10-12');
    await user.clear(attempt);
    await user.type(attempt, '2026-10-11');
    expect(screen.getByText('Select skydivers above to activate the grid.')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Top-down view/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Alex Aero/ }));
    expect(screen.queryByText('Select skydivers above to activate the grid.')).not.toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'Formation grid, 10 by 10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /#2 Alex Aero/ })).toBeInTheDocument();
    expect(screen.getByText(/of 2 selected/)).toHaveTextContent('1 of 2 selected');

    // A vertical type suggests the back-to-front viewpoint until the organizer chooses one.
    expect(screen.getByRole('radio', { name: /Back-to-front view/ })).toBeChecked();
    expect(screen.getByTestId('grid-viewpoint')).toHaveTextContent('Back-to-front view');
    await user.click(screen.getByRole('radio', { name: /Top-down view/ }));
    expect(screen.getByTestId('grid-viewpoint')).toHaveTextContent('Top-down view');
    // Once chosen, changing the type no longer overrides it.
    await user.selectOptions(screen.getByLabelText(/Type/), 'ws-lf-nogrip-vertical');
    expect(screen.getByRole('radio', { name: /Top-down view/ })).toBeChecked();
    await user.selectOptions(screen.getByLabelText(/Type/), 'ws-seq-lf-nogrip-vertical');
    await user.click(screen.getByRole('button', { name: 'Create record' }));

    expect(screen.getByRole('heading', { name: 'WS - Sequential Large Formation (No-grip) Vertical' })).toBeInTheDocument();
    expect(screen.getByText('State · Nevada')).toBeInTheDocument();
    expect(screen.getByText('Oct 11, 2026')).toBeInTheDocument();
    expect(screen.getByText('1 skydiver')).toBeInTheDocument();

    const stored = store.snapshot();
    expect(stored[0].records[0]).toMatchObject({ zone: 'state', state: 'NV', type: 'ws-seq-lf-nogrip-vertical', viewpoint: 'top-down', attemptDate: '2026-10-11' });
  });

  it('adds sequential points as exact copies, and duplicates a saved record', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await createEvent(user);
    await user.click(screen.getByRole('button', { name: '+ Add skydiver' }));
    await addSkydiver(user, { name: 'Alex Aero', id: '100' });
    await user.click(screen.getByRole('button', { name: 'Save & add another' }));
    await addSkydiver(user, { name: 'Zoe Zephyr', id: '200' });
    await user.click(screen.getByRole('button', { name: 'Add skydiver' }));

    await user.click(screen.getByRole('link', { name: '+ New record' }));
    await user.selectOptions(screen.getByLabelText(/Zone/), 'national');
    await user.selectOptions(screen.getByLabelText(/Type/), 'ws-lf-grip');
    await user.click(screen.getByRole('button', { name: /Select all/ }));
    // Non-sequential: no points UI.
    expect(screen.queryByRole('button', { name: '+ Add point' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Type/), 'ws-seq-lf-nogrip-horizontal');
    expect(screen.getByRole('tab', { name: 'Point 1' })).toHaveAttribute('aria-selected', 'true');

    // Move Alex (#1, starts in the last cell) on Point 1, then add Point 2: it copies Point 1 exactly.
    await user.click(screen.getByRole('button', { name: /#1 Alex Aero/ }));
    await user.keyboard('{ArrowUp}');
    expect(screen.getByTestId('cell-8-9')).toHaveAccessibleName(/#1 Alex Aero/);
    await user.click(screen.getByRole('button', { name: '+ Add point' }));
    expect(screen.getByRole('tab', { name: /^Point 2/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('cell-8-9')).toHaveAccessibleName(/#1 Alex Aero/);
    // A fresh copy fails the 75% rule: nobody has changed neighbours yet, and the tab is flagged.
    expect(screen.getByTestId('point-transitions')).toHaveTextContent('Point 1 → Point 2: 0 of 2 changed neighbours (0%)');
    expect(screen.getByRole('tab', { name: 'Point 2 (needs changes)' })).toBeInTheDocument();

    // Changing Point 2 leaves Point 1 alone.
    await user.click(screen.getByRole('button', { name: /#1 Alex Aero/ }));
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('cell-8-8')).toHaveAccessibleName(/#1 Alex Aero/);
    // Alex was diagonal to Zoe and is now directly above her: both see their neighbour on a new side.
    expect(screen.getByTestId('point-transitions')).toHaveTextContent('Point 1 → Point 2: 2 of 2 changed neighbours (100%)');
    expect(screen.getByRole('tab', { name: 'Point 2' })).toBeInTheDocument();
    // Moving Zoe left as well restores the original shape, just shifted one cell: that's no change.
    await user.keyboard('{Escape}'); // deselect Alex, otherwise clicking Zoe swaps them
    await user.click(screen.getByRole('button', { name: /#2 Zoe Zephyr/ }));
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('point-transitions')).toHaveTextContent('0 of 2 changed neighbours (0%)');
    expect(screen.getByRole('tab', { name: 'Point 2 (needs changes)' })).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('point-transitions')).toHaveTextContent('2 of 2 changed neighbours (100%)');
    await user.click(screen.getByRole('tab', { name: 'Point 1' }));
    expect(screen.getByTestId('cell-8-9')).toHaveAccessibleName(/#1 Alex Aero/);

    // Switching to a non-sequential type warns that extra points will be dropped.
    await user.selectOptions(screen.getByLabelText(/Type/), 'ws-lf-grip');
    expect(screen.getByText(/Only Point 1 will be kept/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Type/), 'ws-seq-lf-nogrip-horizontal');
    await user.click(screen.getByRole('button', { name: 'Create record' }));

    expect(screen.getByText('2 points')).toBeInTheDocument();
    expect(screen.getByText('✓ Point changes OK')).toBeInTheDocument();
    let stored = store.snapshot();
    expect(stored[0].records[0].grids).toHaveLength(2);

    // Duplicate opens a prefilled form; nothing is saved until Create.
    await user.click(screen.getByRole('link', { name: /Duplicate WS - Sequential/ }));
    expect(screen.getByRole('heading', { name: 'Duplicate record' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Type/)).toHaveValue('ws-seq-lf-nogrip-horizontal');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    await user.click(screen.getByRole('tab', { name: 'Point 2' }));
    expect(screen.getByTestId('cell-8-8')).toHaveAccessibleName(/#1 Alex Aero/);
    await user.click(screen.getByRole('button', { name: 'Create record' }));

    stored = store.snapshot();
    expect(stored[0].records).toHaveLength(2);
    expect(stored[0].records[1].id).not.toBe(stored[0].records[0].id);
    expect(stored[0].records[1].grids).toEqual(stored[0].records[0].grids);
  });

  it('marks videographers (unchecked by default) and leaves them off the grid', async () => {
    const user = userEvent.setup();
    renderApp();
    await createEvent(user);

    // Skydiver pool comes before Records on the event page.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf('Skydiver pool')).toBeLessThan(headings.indexOf('Records'));

    await user.click(screen.getByRole('button', { name: '+ Add skydiver' }));
    expect(screen.getByRole('checkbox', { name: /Videographer/ })).not.toBeChecked();
    await addSkydiver(user, { name: 'Vic Video', id: '300' });
    await user.click(screen.getByRole('checkbox', { name: /Videographer/ }));
    await user.click(screen.getByRole('button', { name: 'Save & add another' }));
    // Reset for the next entry.
    expect(screen.getByRole('checkbox', { name: /Videographer/ })).not.toBeChecked();
    await addSkydiver(user, { name: 'Alex Aero', id: '100' });
    await user.click(screen.getByRole('button', { name: 'Add skydiver' }));

    const videoRow = screen.getAllByRole('row').find((r) => r.textContent?.includes('Video'))!;
    expect(within(videoRow).getByText('Videographer')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '+ New record' }));
    await user.click(screen.getByRole('checkbox', { name: /Vic Video/ }));
    expect(screen.getByText(/Videographers are not placed on the grid/)).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Alex Aero/ }));
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /#2 Alex Aero/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Vic Video/ })).not.toBeInTheDocument();
  });

  it("admins can manage other organizers' events; only your own get the Yours badge", async () => {
    const others: RecordEvent = {
      ...eventDetails({ name: 'Someone else event' }),
      id: 'e-other',
      createdBy: 'someone-else',
      createdAt: '',
      updatedAt: '',
      nextJumperNumber: 1,
      skydivers: [],
      records: [],
    };
    const user = userEvent.setup();
    renderApp('/', { auth: { role: 'admin' }, events: [others] });
    const card = (await screen.findByRole('link', { name: /Someone else event/ })) as HTMLElement;
    expect(within(card).queryByText('Yours')).not.toBeInTheDocument();
    await user.click(card);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit event' })).toBeInTheDocument();
    expect(screen.queryByText(/View only/)).not.toBeInTheDocument();
  });

  it('offers a one-time import of events saved in this browser', async () => {
    const legacy = {
      ...eventDetails({ name: 'Old Browser Event' }),
      id: 'legacy-1',
      createdBy: 'old-profile',
      createdAt: '',
      updatedAt: '',
      nextJumperNumber: 2,
      skydivers: [],
      records: [],
    };
    window.localStorage.setItem('wsr:v1:events', JSON.stringify([legacy]));
    const user = userEvent.setup();
    const store = renderApp();
    await user.click(await screen.findByRole('button', { name: 'Import 1 event' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Imported 1 event into your account.');
    expect(screen.getByRole('link', { name: /Old Browser Event/ })).toBeInTheDocument();
    expect(store.snapshot()[0].createdBy).toBe(USER_ID);
    expect(window.localStorage.getItem('wsr:v1:events')).toBeNull();
    expect(window.localStorage.getItem('wsr:v1:events.imported')).not.toBeNull();
  });

  it('organizers get a read-only view of events they did not create', async () => {
    const others: RecordEvent = {
      ...eventDetails({ name: 'Someone else event' }),
      id: 'e-other',
      createdBy: 'someone-else',
      createdAt: '',
      updatedAt: '',
      nextJumperNumber: 1,
      skydivers: [],
      records: [],
    };
    renderApp('/events/e-other', { events: [others] });
    expect(await screen.findByText(/View only/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add skydiver' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '+ New record' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeInTheDocument();
  });

  describe('share links', () => {
    const sharedEvent = (): RecordEvent => ({
      ...eventDetails({
        name: 'Shared Record Event',
        localJudge: { name: 'Sam Safety', phone: '555-0111', email: 'sam@example.com', role: 'dz-sta' },
        notes: 'Private notes',
      }),
      id: 'e-shared',
      createdBy: USER_ID,
      createdAt: '',
      updatedAt: '',
      nextJumperNumber: 3,
      shareToken: 'tok-123',
      skydivers: [
        { id: 's1', jumperNumber: 1, firstName: 'Alex', lastName: 'Aero', nickName: 'Ace', uspaMembershipId: '987654', membershipExpiration: '2020-01-01', uspaLicenseNumber: 'D-4242', isVideographer: false, addedAt: '' },
        { id: 's2', jumperNumber: 2, firstName: 'Vic', lastName: 'Video', nickName: '', uspaMembershipId: '123123', membershipExpiration: '2027-01-01', uspaLicenseNumber: '', isVideographer: true, addedAt: '' },
      ],
      records: [
        {
          id: 'r1',
          zone: 'national',
          state: '',
          type: 'ws-seq-lf-nogrip-vertical',
          attemptDate: '2026-10-11',
          viewpoint: 'back-to-front',
          skydiverIds: ['s1', 's2'],
          grids: [{ size: 4, positions: { s1: { row: 3, col: 3 } } }, { size: 4, positions: { s1: { row: 0, col: 0 } } }],
          createdAt: '',
          updatedAt: '',
        },
      ],
    });

    it('owners create, replace and stop a participant link', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const event = { ...sharedEvent(), shareToken: null };
      const store = renderApp('/events/e-shared', { events: [event] });

      await user.click(await screen.findByRole('button', { name: 'Create share link' }));
      const link = await screen.findByRole('textbox', { name: 'Participant link' });
      const first = (link as HTMLInputElement).value;
      expect(first).toMatch(/\/share\/.+/);
      expect(store.snapshot()[0].shareToken).toBe(first.split('/share/')[1]);

      await user.click(screen.getByRole('button', { name: 'New link' }));
      await screen.findByDisplayValue((v) => v.includes('/share/') && v !== first);

      await user.click(screen.getByRole('button', { name: 'Stop sharing' }));
      expect(await screen.findByRole('button', { name: 'Create share link' })).toBeInTheDocument();
      expect(store.snapshot()[0].shareToken).toBeNull();
      vi.restoreAllMocks();
    });

    it('participants see a read-only view without signing in, with no personal details or PDFs', async () => {
      renderApp('/share/tok-123', { auth: { status: 'signed-out', role: null, userId: null }, events: [sharedEvent()] });
      expect(await screen.findByRole('heading', { name: 'Shared Record Event' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();

      // Judge name and role, record and formation are shown.
      expect(screen.getByText('Sam Safety')).toBeInTheDocument();
      expect(screen.getByText('DZ S&TA')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'WS - Sequential Large Formation (No-grip) Vertical' })).toBeInTheDocument();
      expect(screen.getByText('Point 2')).toBeInTheDocument();
      expect(screen.getAllByRole('grid')).toHaveLength(2);
      expect(screen.getAllByText('Alex Aero').length).toBeGreaterThan(0);

      // Nothing private, nothing editable, no PDFs, no membership warnings.
      const text = document.body.textContent ?? '';
      for (const secret of ['987654', 'D-4242', '555-0111', 'sam@example.com', 'Private notes', 'Ace']) {
        expect(text).not.toContain(secret);
      }
      expect(screen.queryByText(/Expired/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /PDF/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Edit|Duplicate/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Delete|Remove|Add/ })).not.toBeInTheDocument();
    });

    it('a stopped or unknown link explains itself', async () => {
      renderApp('/share/not-a-real-token', { auth: { status: 'signed-out', role: null, userId: null }, events: [sharedEvent()] });
      expect(await screen.findByRole('heading', { name: "This link isn't active" })).toBeInTheDocument();
    });

    it('marks shared events in the events list', async () => {
      renderApp('/', { events: [sharedEvent()] });
      const card = await screen.findByRole('link', { name: /Shared Record Event/ });
      expect(within(card).getByText('Shared')).toBeInTheDocument();
      expect(within(card).getByText('Yours')).toBeInTheDocument();
    });
  });
});
