jest.mock('../api', () => ({ useProfileQuery: jest.fn() }));
jest.mock('../logout', () => ({ useLogout: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeUser } from '../../../test-utils/auth-fixtures';
import { useProfileQuery } from '../api';
import { useLogout } from '../logout';
import { ProfileView } from './ProfileView';

const mockUseProfileQuery = useProfileQuery as jest.Mock;
const mockUseLogout = useLogout as jest.Mock;

beforeEach(() => {
  mockUseProfileQuery.mockReset();
  mockUseLogout.mockReset();
});

describe('ProfileView', () => {
  it('renders no name text while loading', async () => {
    mockUseProfileQuery.mockReturnValue({ data: undefined, isLoading: true });
    mockUseLogout.mockReturnValue(jest.fn());

    await render(<ProfileView />);

    expect(screen.queryByText('Ada Rider')).toBeNull();
  });

  it('renders name, email, and Active status for an active user', async () => {
    mockUseProfileQuery.mockReturnValue({
      data: {
        user: makeUser({ first_name: 'Ada', last_name: 'Rider', email: 'rider@example.com' }),
      },
      isLoading: false,
    });
    mockUseLogout.mockReturnValue(jest.fn());

    await render(<ProfileView />);

    expect(screen.getByText('Ada Rider')).toBeTruthy();
    expect(screen.getByText('rider@example.com')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('renders Deactivated with no extra warning copy for a deactivated user', async () => {
    mockUseProfileQuery.mockReturnValue({
      data: { user: makeUser({ account_status: 'deactivated' }) },
      isLoading: false,
    });
    mockUseLogout.mockReturnValue(jest.fn());

    await render(<ProfileView />);

    expect(screen.queryAllByText(/deactivat/i)).toHaveLength(1);
  });

  it('renders no email-verification text', async () => {
    mockUseProfileQuery.mockReturnValue({
      data: { user: makeUser() },
      isLoading: false,
    });
    mockUseLogout.mockReturnValue(jest.fn());

    await render(<ProfileView />);

    expect(screen.queryByText(/verif/i)).toBeNull();
  });

  it('calls useLogout()\'s returned function exactly once when Log out is pressed', async () => {
    const logoutSpy = jest.fn();
    mockUseProfileQuery.mockReturnValue({
      data: { user: makeUser() },
      isLoading: false,
    });
    mockUseLogout.mockReturnValue(logoutSpy);

    await render(<ProfileView />);
    await fireEvent.press(screen.getByText('Log out'));

    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  it('renders email as text, never as an editable control', async () => {
    mockUseProfileQuery.mockReturnValue({
      data: { user: makeUser({ email: 'rider@example.com' }) },
      isLoading: false,
    });
    mockUseLogout.mockReturnValue(jest.fn());

    await render(<ProfileView />);

    expect(screen.queryByDisplayValue('rider@example.com')).toBeNull();
  });
});
