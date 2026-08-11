import { render, screen } from '@testing-library/react-native';

import { AccountStatusBadge } from './AccountStatusBadge';

describe('AccountStatusBadge', () => {
  it('renders "Active" for status="active"', async () => {
    await render(<AccountStatusBadge status="active" />);

    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('renders "Deactivated" for status="deactivated"', async () => {
    await render(<AccountStatusBadge status="deactivated" />);

    expect(screen.getByText('Deactivated')).toBeTruthy();
  });
});
