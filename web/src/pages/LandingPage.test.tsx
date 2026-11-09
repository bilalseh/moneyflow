import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LandingPage } from '@/pages/LandingPage';
import { renderWithProviders } from '@/test/render';

describe('LandingPage', () => {
  it('shows the headline and the two entry buttons', () => {
    renderWithProviders(<LandingPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/understand your money/i);
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /try the demo/i })).toBeDisabled();
  });

  it('switches to Arabic', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LandingPage />);

    await user.selectOptions(screen.getByRole('combobox'), 'ar');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('افهم أموالك');
  });
});
