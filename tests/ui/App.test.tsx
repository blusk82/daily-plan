import { render, screen } from '@testing-library/react';
import App from '../../src/ui/App';

test('renders the app title', () => {
  render(<App />);
  expect(screen.getByText('Today')).toBeInTheDocument();
});
