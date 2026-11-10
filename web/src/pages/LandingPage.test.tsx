import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAuthStore } from '@/features/auth/authStore';
import { LandingPage } from '@/pages/LandingPage';
import { renderWithProviders } from '@/test/render';

describe('LandingPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'signedOut', user: null });
  });

  it('offers the demo, Google sign-in and a guest start', () => {
    renderWithProviders(<LandingPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/understand your money/i);
    expect(screen.getByRole('button', { name: /try the demo/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /start from scratch/i })).toBeEnabled();
  });

  it('links signed-in visitors straight to the app', () => {
    useAuthStore.setState({
      status: 'signedIn',
      user: { uid: 'u', isAnonymous: true, displayName: null, email: null, photoURL: null },
    });
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole('link', { name: /open your dashboard/i })).toHaveAttribute(
      'href',
      '/app',
    );
  });

  it('switches to Arabic', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LandingPage />);

    await user.selectOptions(screen.getByRole('combobox'), 'ar');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('افهم أموالك');
  });
});
