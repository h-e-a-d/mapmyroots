import { describe, it, expect, beforeEach, vi } from 'vitest';
import analyticsService from '../../src/analytics/analytics-service.js';

describe('analyticsService — media tracking methods', () => {
  let sendSpy;

  beforeEach(() => {
    sendSpy = vi.spyOn(analyticsService, 'sendEvent').mockImplementation(() => {});
  });

  describe('trackPhotoUploaded', () => {
    it('emits photo_uploaded with media_upload category and normalized params', () => {
      analyticsService.trackPhotoUploaded({
        source: 'drop',
        fileSize: 2048,
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
        wasReplacement: true
      });
      expect(sendSpy).toHaveBeenCalledWith('photo_uploaded', expect.objectContaining({
        category: 'media_upload',
        source: 'drop',
        file_size_kb: 2,
        mime_type: 'image/jpeg',
        width: 800,
        height: 600,
        was_replacement: true
      }));
    });

    it('defaults source to picker and tolerates missing fields', () => {
      analyticsService.trackPhotoUploaded({});
      const params = sendSpy.mock.calls[0][1];
      expect(params.source).toBe('picker');
      expect(params.was_replacement).toBe(false);
      expect(params.file_size_kb).toBeNull();
    });
  });

  describe('trackPhotoUploadFailed', () => {
    it('includes error_type and success:false', () => {
      analyticsService.trackPhotoUploadFailed('decode_failed', { mimeType: 'image/heic', fileSize: 1024 });
      expect(sendSpy).toHaveBeenCalledWith('photo_upload_failed', expect.objectContaining({
        category: 'media_upload',
        error_type: 'decode_failed',
        success: false,
        mime_type: 'image/heic',
        file_size_kb: 1
      }));
    });

    it('falls back to unknown error_type when none supplied', () => {
      analyticsService.trackPhotoUploadFailed(null, {});
      expect(sendSpy.mock.calls[0][1].error_type).toBe('unknown');
    });
  });

  describe('trackPhotoRemoved + trackPhotoCropAdjusted', () => {
    it('photo_removed uses media_management category', () => {
      analyticsService.trackPhotoRemoved();
      expect(sendSpy).toHaveBeenCalledWith('photo_removed', expect.objectContaining({ category: 'media_management' }));
    });

    it('photo_crop_adjusted preserves action', () => {
      analyticsService.trackPhotoCropAdjusted('zoom');
      expect(sendSpy.mock.calls[0][1].action).toBe('zoom');
    });
  });

  describe('trackDocumentUploaded', () => {
    it('emits document_uploaded with kind and doc_count_after', () => {
      analyticsService.trackDocumentUploaded({
        kind: 'pdf',
        source: 'picker',
        fileSize: 5120,
        mimeType: 'application/pdf',
        docCountAfter: 3
      });
      expect(sendSpy).toHaveBeenCalledWith('document_uploaded', expect.objectContaining({
        category: 'media_upload',
        kind: 'pdf',
        source: 'picker',
        file_size_kb: 5,
        mime_type: 'application/pdf',
        doc_count_after: 3
      }));
    });
  });

  describe('trackDocumentUploadFailed', () => {
    it('passes error_type and success false', () => {
      analyticsService.trackDocumentUploadFailed('limit_reached', { kind: 'image', fileSize: 100 });
      expect(sendSpy.mock.calls[0][1]).toMatchObject({
        error_type: 'limit_reached',
        success: false,
        kind: 'image'
      });
    });
  });

  describe('trackDocumentMetadataSaved', () => {
    it('coerces presence flags to booleans', () => {
      analyticsService.trackDocumentMetadataSaved({
        kind: 'image',
        hasTitle: 'yes',
        hasPlace: 0,
        hasEventDate: 1
      });
      const params = sendSpy.mock.calls[0][1];
      expect(params.has_title).toBe(true);
      expect(params.has_place).toBe(false);
      expect(params.has_event_date).toBe(true);
    });
  });

  describe('trackDocumentViewer*', () => {
    it('opened includes kind and doc_count', () => {
      analyticsService.trackDocumentViewerOpened({ kind: 'pdf', docCount: 4 });
      expect(sendSpy.mock.calls[0][1]).toMatchObject({ kind: 'pdf', doc_count: 4 });
    });

    it('navigated preserves direction', () => {
      analyticsService.trackDocumentViewerNavigated('next');
      expect(sendSpy.mock.calls[0][1].direction).toBe('next');
    });
  });

  describe('trackStorageWarning', () => {
    it('computes usage/quota in MB and percent_used', () => {
      analyticsService.trackStorageWarning({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });
      const params = sendSpy.mock.calls[0][1];
      expect(params.usage_mb).toBe(50);
      expect(params.quota_mb).toBe(100);
      expect(params.percent_used).toBe(50);
    });

    it('handles missing quota safely', () => {
      analyticsService.trackStorageWarning({});
      const params = sendSpy.mock.calls[0][1];
      expect(params.percent_used).toBeNull();
    });
  });

  describe('share + marriage + PWA + view + disclosure trackers', () => {
    it('share_url_generated includes url_bytes and node_count', () => {
      analyticsService.trackShareUrlGenerated({ urlBytes: 1234, nodeCount: 10 });
      expect(sendSpy.mock.calls[0]).toEqual([
        'share_url_generated',
        expect.objectContaining({ category: 'share', url_bytes: 1234, node_count: 10 })
      ]);
    });

    it('share_url_too_large marks success false', () => {
      analyticsService.trackShareUrlTooLarge({ urlBytes: 9999, nodeCount: 200 });
      expect(sendSpy.mock.calls[0][1].success).toBe(false);
    });

    it('share_url_copied uses share category', () => {
      analyticsService.trackShareUrlCopied();
      expect(sendSpy.mock.calls[0][1].category).toBe('share');
    });

    it('marriage_added uses relationship_management category', () => {
      analyticsService.trackMarriageAdded();
      expect(sendSpy.mock.calls[0]).toEqual([
        'marriage_added',
        expect.objectContaining({ category: 'relationship_management' })
      ]);
    });

    it('marriage_removed uses relationship_management category', () => {
      analyticsService.trackMarriageRemoved();
      expect(sendSpy.mock.calls[0][0]).toBe('marriage_removed');
    });

    it('pwa_install_dismissed carries method', () => {
      analyticsService.trackPwaInstallDismissed('button');
      expect(sendSpy.mock.calls[0][1].method).toBe('button');
    });

    it('view_changed includes view and trigger', () => {
      analyticsService.trackViewChanged('treeChart', 'keyboard');
      expect(sendSpy.mock.calls[0][1]).toMatchObject({ view: 'treeChart', trigger: 'keyboard' });
    });

    it('ui_disclosure_toggled coerces expanded to boolean', () => {
      analyticsService.trackDisclosureToggled('person_notes', 'truthy');
      expect(sendSpy.mock.calls[0][1]).toMatchObject({
        disclosure_name: 'person_notes',
        expanded: true
      });
    });
  });
});
