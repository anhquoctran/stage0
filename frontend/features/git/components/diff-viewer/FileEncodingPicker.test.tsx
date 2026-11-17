import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { FileEncodingPicker } from './FileEncodingPicker';
import encodings from '../../../../../shared/text-encodings.json';

function EncodingSelection() {
  const [encoding, setEncoding] = useState<string | null>(null);
  return <><FileEncodingPicker encoding={encoding} onChange={setEncoding} />
    <output data-testid="encoding">{encoding ?? 'automatic'}</output></>;
}

it('lists every supported codec and Automatic resets the file selection through the real portal', async () => {
  const user = userEvent.setup();
  render(<EncodingSelection />);
  const trigger = screen.getByRole('button', { name: 'File encoding' });
  await user.click(trigger);
  expect(screen.getAllByRole('option')).toHaveLength(encodings.length + 1);
  for (const encoding of encodings) expect(screen.getByRole('option', { name: encoding })).toBeInTheDocument();
  await user.click(screen.getByRole('option', { name: 'Windows-1258' }));
  expect(trigger).toHaveTextContent('Windows-1258');
  expect(screen.getByTestId('encoding')).toHaveTextContent('Windows-1258');
  await user.click(trigger);
  await user.click(screen.getByRole('option', { name: 'Automatic' }));
  expect(screen.getByTestId('encoding')).toHaveTextContent('automatic');
  expect(trigger).toHaveFocus();
});
