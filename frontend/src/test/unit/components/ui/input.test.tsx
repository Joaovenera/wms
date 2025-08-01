import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/input';

describe('Input Component', () => {
  it('should render input element', () => {
    render(<Input />);
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should display placeholder text', () => {
    render(<Input placeholder="Enter text here" />);
    
    expect(screen.getByPlaceholderText('Enter text here')).toBeInTheDocument();
  });

  it('should handle text input', async () => {
    const user = userEvent.setup();
    render(<Input />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'Hello World');
    
    expect(input).toHaveValue('Hello World');
  });

  it('should handle onChange events', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    
    render(<Input onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'test');
    
    expect(handleChange).toHaveBeenCalledTimes(4); // Once for each character
  });

  it('should be disabled when disabled prop is true', async () => {
    const user = userEvent.setup();
    render(<Input disabled />);
    
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    
    await user.type(input, 'test');
    expect(input).toHaveValue('');
  });

  it('should handle different input types', () => {
    const { rerender } = render(<Input type="password" />);
    const passwordInput = screen.getByDisplayValue('');
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    rerender(<Input type="email" />);
    const emailInput = screen.getByRole('textbox');
    expect(emailInput).toHaveAttribute('type', 'email');
    
    rerender(<Input type="number" />);
    const numberInput = screen.getByRole('spinbutton');
    expect(numberInput).toHaveAttribute('type', 'number');
  });

  it('should apply default styling', () => {
    render(<Input />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('flex', 'h-10', 'w-full', 'rounded-md', 'border');
  });

  it('should accept custom className', () => {
    render(<Input className="custom-class" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-class');
  });

  it('should forward refs correctly', () => {
    const ref = vi.fn();
    
    render(<Input ref={ref} />);
    
    expect(ref).toHaveBeenCalled();
  });

  it('should handle focus and blur events', async () => {
    const user = userEvent.setup();
    const handleFocus = vi.fn();
    const handleBlur = vi.fn();
    
    render(<Input onFocus={handleFocus} onBlur={handleBlur} />);
    
    const input = screen.getByRole('textbox');
    
    await user.click(input);
    expect(handleFocus).toHaveBeenCalledTimes(1);
    
    await user.tab();
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('should handle controlled input', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    
    render(<Input value="controlled" onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('controlled');
    
    await user.clear(input);
    await user.type(input, 'new value');
    
    expect(handleChange).toHaveBeenCalled();
  });

  it('should handle uncontrolled input with defaultValue', () => {
    render(<Input defaultValue="default text" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('default text');
  });

  it('should handle numeric input with min and max', () => {
    render(<Input type="number" min="0" max="100" />);
    
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '100');
  });

  it('should handle required attribute', () => {
    render(<Input required />);
    
    const input = screen.getByRole('textbox');
    expect(input).toBeRequired();
  });

  it('should handle readonly attribute', async () => {
    const user = userEvent.setup();
    render(<Input readOnly value="readonly text" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveValue('readonly text');
    
    await user.type(input, 'new text');
    expect(input).toHaveValue('readonly text'); // Value shouldn't change
  });

  it('should handle maxLength attribute', async () => {
    const user = userEvent.setup();
    render(<Input maxLength={5} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, '123456789');
    
    expect(input).toHaveValue('12345'); // Should be truncated to maxLength
  });

  it('should handle keyboard events', async () => {
    const user = userEvent.setup();
    const handleKeyDown = vi.fn();
    const handleKeyUp = vi.fn();
    
    render(<Input onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} />);
    
    const input = screen.getByRole('textbox');
    
    await user.type(input, 'a');
    
    expect(handleKeyDown).toHaveBeenCalled();
    expect(handleKeyUp).toHaveBeenCalled();
  });

  it('should have proper ARIA attributes', () => {
    render(<Input aria-label="Test input" aria-describedby="help-text" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-label', 'Test input');
    expect(input).toHaveAttribute('aria-describedby', 'help-text');
  });

  it('should handle paste events', async () => {
    const user = userEvent.setup();
    const handlePaste = vi.fn();
    
    render(<Input onPaste={handlePaste} />);
    
    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.paste('pasted text');
    
    expect(handlePaste).toHaveBeenCalled();
    expect(input).toHaveValue('pasted text');
  });

  it('should handle form association', () => {
    render(
      <form>
        <Input name="username" />
      </form>
    );
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('name', 'username');
  });

  it('should handle autocomplete attribute', () => {
    render(<Input autoComplete="username" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('autocomplete', 'username');
  });

  it('should show invalid state styling', () => {
    render(<Input aria-invalid="true" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});