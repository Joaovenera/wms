import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QrScanner from '@/components/qr-scanner';

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
const mockTrack = {
  stop: vi.fn(),
  getCapabilities: vi.fn(() => ({ torch: true })),
  applyConstraints: vi.fn(),
  getSettings: vi.fn(() => ({ width: 1280, height: 720 }))
};

const mockMediaStream = {
  getVideoTracks: vi.fn(() => [mockTrack]),
  getTracks: vi.fn(() => [mockTrack])
};

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: mockGetUserMedia,
      enumerateDevices: vi.fn().mockResolvedValue([
        {
          deviceId: 'default',
          kind: 'videoinput',
          label: 'Default Camera',
          groupId: 'group1',
        },
      ]),
    },
    writable: true,
  });

  mockGetUserMedia.mockResolvedValue(mockMediaStream);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('QrScanner Component', () => {
  const mockOnScan = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnScan.mockClear();
    mockOnClose.mockClear();
  });

  it('should render QR scanner interface', () => {
    render(<QrScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    expect(screen.getByText('Scanner QR Code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fechar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrada manual/i })).toBeInTheDocument();
  });

  it('should initialize camera on mount', async () => {
    render(<QrScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
    });
  });

  it('should handle camera initialization error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetUserMedia.mockRejectedValueOnce(new Error('Camera not available'));
    
    render(<QrScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText(/erro ao acessar câmera/i)).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('should toggle manual input mode', async () => {
    const user = userEvent.setup();
    render(<QrScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    const manualButton = screen.getByRole('button', { name: /entrada manual/i });
    await user.click(manualButton);
    
    expect(screen.getByPlaceholderText(/digite o código/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar código/i })).toBeInTheDocument();
  });

  it('should handle manual code input', async () => {
    const user = userEvent.setup();
    render(<QrScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    // Switch to manual input
    const manualButton = screen.getByRole('button', { name: /entrada manual/i });
    await user.click(manualButton);
    
    // Enter code
    const input = screen.getByPlaceholderText(/digite o código/i);
    await user.type(input, 'TEST123');
    
    // Confirm
    const confirmButton = screen.getByRole('button', { name: /confirmar código/i });
    await user.click(confirmButton);
    
    expect(mockOnScan).toHaveBeenCalledWith('TEST123');
  });

  it('should not submit empty manual code', async () => {
    const user = userEvent.setup();
    render(<QrScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    // Switch to manual input
    const manualButton = screen.getByRole('button', { name: /entrada manual/i });
    await user.click(manualButton);
    
    // Try to confirm without entering code
    const confirmButton = screen.getByRole('button', { name: /confirmar código/i });
    await user.click(confirmButton);
    
    expect(mockOnScan).not.toHaveBeenCalled();
  });

  it('should show flash toggle when available', async () => {
    render(<QrScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /flash/i })).toBeInTheDocument();
    });
  });

  it('should handle flash toggle', async () => {
    const user = userEvent.setup();
    render(<QrScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /flash/i })).toBeInTheDocument();
    });
    
    const flashButton = screen.getByRole('button', { name: /flash/i });
    await user.click(flashButton);
    
    expect(mockTrack.applyConstraints).toHaveBeenCalledWith({
      advanced: [{ torch: true }]
    });
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<QrScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    const closeButton = screen.getByRole('button', { name: /fechar/i });
    await user.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should clean up camera stream on unmount', () => {
    const { unmount } = render(<QrScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    unmount();
    
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('should handle video element reference correctly', async () => {
    render(<QrScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    await waitFor(() => {
      const video = screen.getByRole('img', { hidden: true }); // video elements have img role when hidden
      expect(video).toBeInTheDocument();
    });
  });

  it('should display camera permission error message', async () => {
    mockGetUserMedia.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'));
    
    render(<QrScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText(/permissão da câmera negada/i)).toBeInTheDocument();
    });
  });

  it('should display camera not found error message', async () => {
    mockGetUserMedia.mockRejectedValueOnce(new DOMException('Device not found', 'NotFoundError'));
    
    render(<QrScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText(/câmera não encontrada/i)).toBeInTheDocument();
    });
  });
});