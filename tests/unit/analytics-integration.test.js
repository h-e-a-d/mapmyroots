import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '../../src/utils/event-bus.js';
import AnalyticsIntegration from '../../src/analytics/analytics-integration.js';
import analyticsService from '../../src/analytics/analytics-service.js';

describe('AnalyticsIntegration — new media/share/marriage/PWA/view wiring', () => {
  let bus;
  let integration;
  let spies;

  beforeEach(() => {
    bus = new EventBus();
    integration = new AnalyticsIntegration(bus);

    spies = {
      photoUploaded: vi.spyOn(analyticsService, 'trackPhotoUploaded').mockImplementation(() => {}),
      photoUploadFailed: vi.spyOn(analyticsService, 'trackPhotoUploadFailed').mockImplementation(() => {}),
      photoRemoved: vi.spyOn(analyticsService, 'trackPhotoRemoved').mockImplementation(() => {}),
      photoCrop: vi.spyOn(analyticsService, 'trackPhotoCropAdjusted').mockImplementation(() => {}),
      docUploaded: vi.spyOn(analyticsService, 'trackDocumentUploaded').mockImplementation(() => {}),
      docUploadFailed: vi.spyOn(analyticsService, 'trackDocumentUploadFailed').mockImplementation(() => {}),
      docRemoved: vi.spyOn(analyticsService, 'trackDocumentRemoved').mockImplementation(() => {}),
      docMeta: vi.spyOn(analyticsService, 'trackDocumentMetadataSaved').mockImplementation(() => {}),
      docViewerOpened: vi.spyOn(analyticsService, 'trackDocumentViewerOpened').mockImplementation(() => {}),
      docViewerNav: vi.spyOn(analyticsService, 'trackDocumentViewerNavigated').mockImplementation(() => {}),
      storage: vi.spyOn(analyticsService, 'trackStorageWarning').mockImplementation(() => {}),
      shareGen: vi.spyOn(analyticsService, 'trackShareUrlGenerated').mockImplementation(() => {}),
      shareBig: vi.spyOn(analyticsService, 'trackShareUrlTooLarge').mockImplementation(() => {}),
      shareCopy: vi.spyOn(analyticsService, 'trackShareUrlCopied').mockImplementation(() => {}),
      marriageAdd: vi.spyOn(analyticsService, 'trackMarriageAdded').mockImplementation(() => {}),
      marriageRm: vi.spyOn(analyticsService, 'trackMarriageRemoved').mockImplementation(() => {}),
      pwaShown: vi.spyOn(analyticsService, 'trackPwaInstallPromptShown').mockImplementation(() => {}),
      pwaAccepted: vi.spyOn(analyticsService, 'trackPwaInstallAccepted').mockImplementation(() => {}),
      pwaDismissed: vi.spyOn(analyticsService, 'trackPwaInstallDismissed').mockImplementation(() => {}),
      view: vi.spyOn(analyticsService, 'trackViewChanged').mockImplementation(() => {}),
      disclosure: vi.spyOn(analyticsService, 'trackDisclosureToggled').mockImplementation(() => {}),
      session: vi.spyOn(analyticsService, 'trackSessionStarted').mockImplementation(() => {})
    };

    integration.init();
  });

  afterEach(() => {
    integration.destroy();
    vi.restoreAllMocks();
  });

  it('media:photo:uploaded routes to trackPhotoUploaded with the payload', () => {
    const payload = { source: 'drop', fileSize: 1024, mimeType: 'image/png', wasReplacement: false };
    bus.emit('media:photo:uploaded', payload);
    expect(spies.photoUploaded).toHaveBeenCalledWith(payload);
  });

  it('media:photo:upload:failed forwards errorType and payload', () => {
    bus.emit('media:photo:upload:failed', { errorType: 'decode_failed', mimeType: 'image/heic' });
    expect(spies.photoUploadFailed).toHaveBeenCalledWith('decode_failed', expect.objectContaining({ errorType: 'decode_failed' }));
  });

  it('media:photo:removed and media:photo:crop:adjusted route correctly', () => {
    bus.emit('media:photo:removed', {});
    expect(spies.photoRemoved).toHaveBeenCalled();
    bus.emit('media:photo:crop:adjusted', { action: 'reset' });
    expect(spies.photoCrop).toHaveBeenCalledWith('reset');
  });

  it('media:document:* events route to their tracker methods', () => {
    bus.emit('media:document:uploaded', { kind: 'pdf', source: 'picker', docCountAfter: 2 });
    expect(spies.docUploaded).toHaveBeenCalledWith(expect.objectContaining({ kind: 'pdf' }));

    bus.emit('media:document:upload:failed', { errorType: 'pdf_invalid', kind: 'pdf' });
    expect(spies.docUploadFailed).toHaveBeenCalledWith('pdf_invalid', expect.objectContaining({ kind: 'pdf' }));

    bus.emit('media:document:removed', { kind: 'image' });
    expect(spies.docRemoved).toHaveBeenCalledWith('image');

    bus.emit('media:document:metadata:saved', { kind: 'pdf', hasTitle: true });
    expect(spies.docMeta).toHaveBeenCalledWith(expect.objectContaining({ kind: 'pdf' }));

    bus.emit('media:document:viewer:opened', { kind: 'image', docCount: 3 });
    expect(spies.docViewerOpened).toHaveBeenCalledWith(expect.objectContaining({ docCount: 3 }));

    bus.emit('media:document:viewer:navigated', { direction: 'next' });
    expect(spies.docViewerNav).toHaveBeenCalledWith('next');
  });

  it('storage:warning:shown routes to trackStorageWarning', () => {
    bus.emit('storage:warning:shown', { usage: 500, quota: 1000 });
    expect(spies.storage).toHaveBeenCalledWith({ usage: 500, quota: 1000 });
  });

  it('share events route correctly', () => {
    bus.emit('share:url:generated', { urlBytes: 100, nodeCount: 5 });
    expect(spies.shareGen).toHaveBeenCalledWith({ urlBytes: 100, nodeCount: 5 });

    bus.emit('share:url:too_large', { urlBytes: 9999, nodeCount: 200 });
    expect(spies.shareBig).toHaveBeenCalled();

    bus.emit('share:url:copied', {});
    expect(spies.shareCopy).toHaveBeenCalled();
  });

  it('marriage:added and marriage:removed route correctly', () => {
    bus.emit('marriage:added', {});
    expect(spies.marriageAdd).toHaveBeenCalled();
    bus.emit('marriage:removed', {});
    expect(spies.marriageRm).toHaveBeenCalled();
  });

  it('pwa:install:* events route correctly', () => {
    bus.emit('pwa:install:prompt:shown', {});
    expect(spies.pwaShown).toHaveBeenCalled();

    bus.emit('pwa:install:accepted', {});
    expect(spies.pwaAccepted).toHaveBeenCalled();

    bus.emit('pwa:install:dismissed', { method: 'button' });
    expect(spies.pwaDismissed).toHaveBeenCalledWith('button');
  });

  it('ui:view:changed routes view and trigger', () => {
    bus.emit('ui:view:changed', { view: 'table', trigger: 'click' });
    expect(spies.view).toHaveBeenCalledWith('table', 'click');
  });

  it('ui:disclosure:toggled routes name and expanded', () => {
    bus.emit('ui:disclosure:toggled', { name: 'person_notes', expanded: true });
    expect(spies.disclosure).toHaveBeenCalledWith('person_notes', true);
  });
});
