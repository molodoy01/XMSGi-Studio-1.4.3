import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@studio/lib/i18n';
import type { WorkspaceAttachment } from '../lib/workspaceAttachments';
import { useWorkspaceAttachmentPreviews } from './useWorkspaceAttachmentPreviews';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useWorkspaceAttachmentPreviews', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'draftStorage');
  });

  it('retries an image preview when the attachment list changes during loading', async () => {
    const firstRead = createDeferred<{ success: boolean; dataUrl?: string }>();
    const readImageDataUrl = vi.fn()
      .mockImplementationOnce(() => firstRead.promise)
      .mockResolvedValue({ success: true, dataUrl: 'data:image/png;base64,dGVzdA==' });
    Object.defineProperty(window, 'draftStorage', {
      configurable: true,
      value: { load: vi.fn(), readImageDataUrl },
    });

    const photo: WorkspaceAttachment = {
      id: 'restored-photo',
      type: 'image',
      name: 'photo.png',
      mimeType: 'image/png',
      size: 10,
      path: '/stored/photo.png',
      position: 0,
    };
    const secondPhoto: WorkspaceAttachment = {
      ...photo,
      id: 'second-photo',
      path: '/stored/second-photo.png',
    };
    const setAttachments = vi.fn();
    const showFeedback = vi.fn();
    const wrapper = ({ children }: React.PropsWithChildren) => <LocaleProvider>{children}</LocaleProvider>;
    const { rerender } = renderHook(
      ({ attachments }: { attachments: WorkspaceAttachment[] }) => useWorkspaceAttachmentPreviews({
        attachments,
        setAttachments,
        showFeedback,
      }),
      { initialProps: { attachments: [photo] }, wrapper },
    );

    rerender({ attachments: [photo, secondPhoto] });

    await waitFor(() => {
      expect(readImageDataUrl).toHaveBeenCalledTimes(3);
      expect(setAttachments).toHaveBeenCalled();
    });

    expect(readImageDataUrl.mock.calls.map(([path]) => path)).toEqual([
      '/stored/photo.png',
      '/stored/photo.png',
      '/stored/second-photo.png',
    ]);
    expect(showFeedback).not.toHaveBeenCalled();

    await act(async () => {
      firstRead.resolve({ success: true, dataUrl: 'data:image/png;base64,b2xk' });
    });
  });

  it('reloads a thumbnail when the same saved attachment is reopened', async () => {
    const readImageDataUrl = vi.fn()
      .mockResolvedValueOnce({ success: true, dataUrl: 'data:image/png;base64,b2xk' })
      .mockResolvedValue({ success: true, dataUrl: 'data:image/png;base64,dGVzdA==' });
    Object.defineProperty(window, 'draftStorage', {
      configurable: true,
      value: { load: vi.fn(), readImageDataUrl },
    });

    const photo: WorkspaceAttachment = {
      id: 'saved-photo',
      type: 'image',
      name: 'photo.png',
      mimeType: 'image/png',
      size: 10,
      path: '/stored/photo.png',
      position: 0,
    };
    const showFeedback = vi.fn();
    const wrapper = ({ children }: React.PropsWithChildren) => <LocaleProvider>{children}</LocaleProvider>;
    const { result } = renderHook(() => {
      const [attachments, setAttachments] = useState([photo]);
      useWorkspaceAttachmentPreviews({ attachments, setAttachments, showFeedback });
      return { attachments, setAttachments };
    }, { wrapper });

    await waitFor(() => {
      expect(result.current.attachments[0].previewUrl).toBe('data:image/png;base64,b2xk');
    });

    act(() => result.current.setAttachments([]));
    act(() => result.current.setAttachments([photo]));

    await waitFor(() => {
      expect(readImageDataUrl).toHaveBeenCalledTimes(2);
      expect(result.current.attachments[0].previewUrl).toBe('data:image/png;base64,dGVzdA==');
    });
    expect(showFeedback).not.toHaveBeenCalled();
  });
});
