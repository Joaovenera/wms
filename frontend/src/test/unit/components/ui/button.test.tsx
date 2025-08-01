import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>);
    
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should not handle click when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Button disabled onClick={handleClick}>Disabled button</Button>);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply default variant styling', () => {
    render(<Button>Default button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-primary');
  });

  it('should apply destructive variant styling', () => {
    render(<Button variant="destructive">Delete</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-destructive');
  });

  it('should apply outline variant styling', () => {
    render(<Button variant="outline">Outline button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('border-input');
  });

  it('should apply secondary variant styling', () => {
    render(<Button variant="secondary">Secondary button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-secondary');
  });

  it('should apply ghost variant styling', () => {
    render(<Button variant="ghost">Ghost button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('hover:bg-accent');
  });

  it('should apply link variant styling', () => {
    render(<Button variant="link">Link button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-primary');
  });

  it('should apply small size styling', () => {
    render(<Button size="sm">Small button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('h-9');
  });

  it('should apply large size styling', () => {
    render(<Button size="lg">Large button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('h-11');
  });

  it('should apply icon size styling', () => {
    render(<Button size="icon">👍</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('h-10', 'w-10');
  });

  it('should accept custom className', () => {
    render(<Button className="custom-class">Custom button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should render as different HTML element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link button</a>
      </Button>
    );
    
    expect(screen.getByRole('link')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/test');
  });

  it('should forward refs correctly', () => {
    const ref = vi.fn();
    
    render(<Button ref={ref}>Button with ref</Button>);
    
    expect(ref).toHaveBeenCalled();
  });

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Button onClick={handleClick}>Keyboard button</Button>);
    
    const button = screen.getByRole('button');
    button.focus();
    
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);
    
    await user.keyboard('{Space}');
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('should not handle keyboard events when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Button disabled onClick={handleClick}>Disabled keyboard button</Button>);
    
    const button = screen.getByRole('button');
    button.focus();
    
    await user.keyboard('{Enter}');
    await user.keyboard('{Space}');
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply loading state styling when loading', () => {
    render(<Button loading>Loading button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument(); // Loading spinner
  });

  it('should prevent click events when loading', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Button loading onClick={handleClick}>Loading button</Button>);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should render icon before text when provided', () => {
    render(<Button icon="👍">Button with icon</Button>);
    
    expect(screen.getByText('👍')).toBeInTheDocument();
    expect(screen.getByText('Button with icon')).toBeInTheDocument();
  });

  it('should have proper ARIA attributes', () => {
    render(<Button aria-label="Test button">Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Test button');
  });

  it('should support form submission', () => {
    render(
      <form>
        <Button type="submit">Submit</Button>
      </form>
    );
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
  });
});