import { screen } from '@testing-library/react';

import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { renderWithProviders } from '@/test/render';

describe('DisclaimerBanner', () => {
  it('always shows the educational-use note', () => {
    renderWithProviders(<DisclaimerBanner />);
    expect(screen.getByRole('note')).toHaveTextContent('Educational tool, not financial advice.');
  });
});
