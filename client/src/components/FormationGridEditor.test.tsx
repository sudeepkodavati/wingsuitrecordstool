import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { reconcileGrid } from '../lib/grid';
import type { FormationGrid, RecordEvent } from '../types';
import { FormationGridEditor } from './FormationGridEditor';

const skydivers = [
  { id: 'a', jumperNumber: 1, firstName: 'Alex', lastName: 'Aero', nickName: 'Ace', membershipExpiration: '2027-01-01' },
  { id: 'b', jumperNumber: 2, firstName: 'Bea', lastName: 'Bird', nickName: '', membershipExpiration: '2020-01-01' },
  { id: 'c', jumperNumber: 3, firstName: 'Cal', lastName: 'Cloud', nickName: '', membershipExpiration: '2027-01-01' },
];
const event = { startDate: '2026-10-20', endDate: '2026-10-22', skydivers } as unknown as RecordEvent;
const ids = ['a', 'b', 'c'];

function Harness({ onGrid }: { onGrid?: (g: FormationGrid) => void }) {
  const [grid, setGrid] = useState(() => reconcileGrid(undefined, ids));
  return (
    <FormationGridEditor
      event={event}
      grid={grid}
      skydiverIds={ids}
      onChange={(g) => {
        setGrid(g);
        onGrid?.(g);
      }}
    />
  );
}

const cell = (r: number, c: number) => screen.getByTestId(`cell-${r}-${c}`);

describe('FormationGridEditor', () => {
  it('renders a default 10 × 10 square grid with one icon per skydiver', () => {
    render(<Harness />);
    expect(screen.getByRole('grid', { name: 'Formation grid, 10 by 10' })).toHaveClass('aspect-square');
    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(100);
    expect(screen.getByRole('button', { name: /#1 Alex Aero/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /#2 Bea Bird/ })).toHaveTextContent('2');
  });

  it('starts icons in the last cell and works backwards', () => {
    render(<Harness />);
    expect(cell(9, 9)).toHaveAccessibleName(/#1 Alex Aero/);
    expect(cell(9, 8)).toHaveAccessibleName(/#2 Bea Bird/);
    expect(cell(9, 7)).toHaveAccessibleName(/#3 Cal Cloud/);
  });

  it('shows only the first name in the hover tooltip', () => {
    render(<Harness />);
    const tips = screen.getAllByRole('tooltip', { hidden: true }).map((t) => t.textContent);
    expect(tips.sort()).toEqual(['Alex', 'Bea', 'Cal']);
    // Screen readers still get the full name and status.
    expect(screen.getByRole('button', { name: '#2 Bea Bird · membership expired' })).toBeInTheDocument();
  });

  it('moves an icon by dragging it to an empty cell', () => {
    render(<Harness />);
    const data = new Map<string, string>();
    const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? '' };
    fireEvent.dragStart(screen.getByRole('button', { name: /#1 Alex Aero/ }), { dataTransfer });
    fireEvent.dragOver(cell(4, 5), { dataTransfer });
    fireEvent.drop(cell(4, 5), { dataTransfer });
    expect(cell(4, 5)).toHaveAccessibleName(/#1 Alex Aero/);
    expect(cell(9, 9)).toHaveAccessibleName('Row 10, column 10, empty');
  });

  it('swaps two icons with click-to-move', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /#1 Alex Aero/ }));
    await user.click(screen.getByRole('button', { name: /#3 Cal Cloud/ }));
    expect(cell(9, 9)).toHaveAccessibleName(/#3 Cal Cloud/);
    expect(cell(9, 7)).toHaveAccessibleName(/#1 Alex Aero/);
  });

  it('moves the selected icon with arrow keys and keeps focus on it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /#3 Cal Cloud/ }));
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(cell(7, 7)).toHaveAccessibleName(/#3 Cal Cloud/);
    expect(screen.getByRole('button', { name: /#3 Cal Cloud/ })).toHaveFocus();
  });

  it('resizes the grid but not below what fits everyone', async () => {
    const user = userEvent.setup();
    let last: FormationGrid | undefined;
    render(<Harness onGrid={(g) => (last = g)} />);
    const input = screen.getByRole('spinbutton', { name: 'Grid size' });
    await user.clear(input);
    await user.type(input, '1{Enter}');
    expect(last?.size).toBe(2);
    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'Larger grid' }));
    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(9);
  });

  it('is not editable in read-only mode', () => {
    const grid = reconcileGrid(undefined, ids);
    render(<FormationGridEditor event={event} grid={grid} skydiverIds={ids} readOnly />);
    expect(screen.queryByRole('spinbutton', { name: 'Grid size' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /#1 Alex Aero/ })).toBeDisabled();
  });
});
