jest.mock('../api', () => ({ useChangePasswordMutation: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '../../../api/http-client';
import { useChangePasswordMutation } from '../api';
import { ChangePasswordForm } from './ChangePasswordForm';

const mockUseChangePasswordMutation = useChangePasswordMutation as jest.Mock;
const mockBack = router.back as jest.Mock;

beforeEach(() => {
  mockUseChangePasswordMutation.mockReset();
  mockBack.mockReset();
});

describe('ChangePasswordForm', () => {
  it('renders exactly two password inputs, labelled Current password and New password', async () => {
    mockUseChangePasswordMutation.mockReturnValue({ mutate: jest.fn(), isPending: false });

    await render(<ChangePasswordForm />);

    expect(screen.getByLabelText('Current password')).toBeTruthy();
    expect(screen.getByLabelText('New password')).toBeTruthy();
    expect(screen.queryByLabelText('Confirm password')).toBeNull();
    expect(screen.queryByText(/confirm/i)).toBeNull();
  });

  it('shows one error banner and does not call the mutation when new password is too short', async () => {
    const mutate = jest.fn();
    mockUseChangePasswordMutation.mockReturnValue({ mutate, isPending: false });

    await render(<ChangePasswordForm />);

    await fireEvent.changeText(screen.getByLabelText('Current password'), 'oldpass1');
    await fireEvent.changeText(screen.getByLabelText('New password'), 'short');
    await fireEvent.press(screen.getByText('Change password'));

    expect(screen.getByText('New password must be at least 8 characters')).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('renders the success banner on a successful mutation', async () => {
    const mutate = jest.fn((_payload, handlers) => handlers.onSuccess());
    mockUseChangePasswordMutation.mockReturnValue({ mutate, isPending: false });

    await render(<ChangePasswordForm />);

    await fireEvent.changeText(screen.getByLabelText('Current password'), 'oldpass1');
    await fireEvent.changeText(screen.getByLabelText('New password'), 'newpass1');
    await fireEvent.press(screen.getByText('Change password'));

    expect(screen.getByText('Password changed')).toBeTruthy();
  });

  it('does not call router.back() automatically on success', async () => {
    const mutate = jest.fn((_payload, handlers) => handlers.onSuccess());
    mockUseChangePasswordMutation.mockReturnValue({ mutate, isPending: false });

    await render(<ChangePasswordForm />);

    await fireEvent.changeText(screen.getByLabelText('Current password'), 'oldpass1');
    await fireEvent.changeText(screen.getByLabelText('New password'), 'newpass1');
    await fireEvent.press(screen.getByText('Change password'));

    expect(mockBack).not.toHaveBeenCalled();
  });

  it('calls router.back() exactly once when Back to profile is pressed after success', async () => {
    const mutate = jest.fn((_payload, handlers) => handlers.onSuccess());
    mockUseChangePasswordMutation.mockReturnValue({ mutate, isPending: false });

    await render(<ChangePasswordForm />);

    await fireEvent.changeText(screen.getByLabelText('Current password'), 'oldpass1');
    await fireEvent.changeText(screen.getByLabelText('New password'), 'newpass1');
    await fireEvent.press(screen.getByText('Change password'));

    await fireEvent.press(screen.getByText('Back to profile'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows the backend error message in one banner on an ApiError rejection', async () => {
    const apiError = new ApiError(400, {
      code: 'invalid_password',
      message: 'Current password is incorrect',
    });
    const mutate = jest.fn((_payload, handlers) => handlers.onError(apiError));
    mockUseChangePasswordMutation.mockReturnValue({ mutate, isPending: false });

    await render(<ChangePasswordForm />);

    await fireEvent.changeText(screen.getByLabelText('Current password'), 'oldpass1');
    await fireEvent.changeText(screen.getByLabelText('New password'), 'newpass1');
    await fireEvent.press(screen.getByText('Change password'));

    expect(screen.getByText('Current password is incorrect')).toBeTruthy();
    expect(screen.queryByText('Password changed')).toBeNull();
  });
});
