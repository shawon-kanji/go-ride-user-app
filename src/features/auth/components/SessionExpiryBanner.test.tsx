import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { SessionExpiryBanner } from './SessionExpiryBanner';
import { useSessionStore } from '../../../stores/session-store';

describe('SessionExpiryBanner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useSessionStore.setState({ tokenExpiresAt: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when tokenExpiresAt is null', async () => {
    useSessionStore.setState({ tokenExpiresAt: null });

    await render(<SessionExpiryBanner />);

    expect(screen.toJSON()).toBeNull();
  });

  it('renders nothing when expiry is outside the 5-minute window', async () => {
    useSessionStore.setState({ tokenExpiresAt: Date.now() + 30 * 60 * 1000 });

    await render(<SessionExpiryBanner />);

    expect(screen.toJSON()).toBeNull();
  });

  it('renders a countdown warning when inside the 5-minute window', async () => {
    useSessionStore.setState({ tokenExpiresAt: Date.now() + 4 * 60 * 1000 });

    await render(<SessionExpiryBanner />);

    expect(screen.getByText(/Session ending in 4 min/)).toBeTruthy();
  });

  it('renders nothing when the token is already expired', async () => {
    useSessionStore.setState({ tokenExpiresAt: Date.now() - 1000 });

    await render(<SessionExpiryBanner />);

    expect(screen.toJSON()).toBeNull();
  });

  it('hides the banner when the dismiss control is pressed', async () => {
    useSessionStore.setState({ tokenExpiresAt: Date.now() + 4 * 60 * 1000 });

    await render(<SessionExpiryBanner />);

    expect(screen.getByText(/Session ending in 4 min/)).toBeTruthy();

    await fireEvent.press(screen.getByText('✕'));

    expect(screen.toJSON()).toBeNull();
  });

  it('reappears when tokenExpiresAt changes after dismissal (re-login case)', async () => {
    useSessionStore.setState({ tokenExpiresAt: Date.now() + 4 * 60 * 1000 });

    await render(<SessionExpiryBanner />);
    await fireEvent.press(screen.getByText('✕'));
    expect(screen.toJSON()).toBeNull();

    await act(() => {
      useSessionStore.setState({ tokenExpiresAt: Date.now() + 3 * 60 * 1000 });
    });

    expect(screen.getByText(/Session ending in 3 min/)).toBeTruthy();
  });

  it('re-evaluates on the 30s tick as time advances into the window', async () => {
    useSessionStore.setState({ tokenExpiresAt: Date.now() + 6 * 60 * 1000 });

    await render(<SessionExpiryBanner />);

    expect(screen.toJSON()).toBeNull();

    await act(() => {
      jest.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(screen.getByText(/Session ending in/)).toBeTruthy();
  });
});
