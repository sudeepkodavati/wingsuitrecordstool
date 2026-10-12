import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { STORAGE_KEYS } from './lib/storage';

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

async function createProfileAndEvent(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Organizer name'), 'Pat Organizer');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(screen.getByRole('link', { name: 'Create your first event' }));

  await user.type(screen.getByLabelText(/Event name/), 'Perris Vertical Record');
  await user.type(screen.getByLabelText(/Start date/), '2026-10-10');
  await user.type(screen.getByLabelText(/End date/), '2026-10-12');
  await user.type(screen.getByLabelText(/Drop zone/), 'Skydive Perris');
  await user.type(screen.getByLabelText(/City/), 'Perris');
  await user.selectOptions(screen.getByLabelText(/State/), 'CA');
  const organizer = screen.getByRole('heading', { name: 'Organizer' }).closest('section')!;
  await user.type(within(organizer).getByLabelText('Phone'), '555-0100');
  await user.click(screen.getByRole('button', { name: 'Create event' }));
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
  it('asks for an organizer name first', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
  });

  it('creates an event, builds a pool sorted by name, flags expired memberships, and blocks duplicates', async () => {
    const user = userEvent.setup();
    renderApp();
    await createProfileAndEvent(user);

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

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.events)!);
    expect(stored[0].skydivers).toHaveLength(2);
  });

  it('creates a State record with skydivers picked from the pool', async () => {
    const user = userEvent.setup();
    renderApp();
    await createProfileAndEvent(user);

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

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.events)!);
    expect(stored[0].records[0]).toMatchObject({ zone: 'state', state: 'NV', type: 'ws-seq-lf-nogrip-vertical', viewpoint: 'top-down', attemptDate: '2026-10-11' });
  });

  it('marks videographers (unchecked by default) and leaves them off the grid', async () => {
    const user = userEvent.setup();
    renderApp();
    await createProfileAndEvent(user);

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

  it('hides edit and delete controls from other organizer profiles', async () => {
    const user = userEvent.setup();
    renderApp();
    await createProfileAndEvent(user);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Organizer:/ }));
    await user.type(screen.getByLabelText('Organizer name'), 'Someone Else');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit event' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add skydiver' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '+ New record' })).not.toBeInTheDocument();
    expect(screen.getByText(/View only/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeInTheDocument();
  });
});
