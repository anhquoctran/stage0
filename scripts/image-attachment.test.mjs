import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks, componentHarness, componentNodes } from './helpers/componentHarness.mjs';

const imageAttachment = loadWithMocks(
  new URL('../frontend/common/utils/imageAttachment.ts', import.meta.url),
  {
    '@tauri-apps/api/core': {
      isTauri: () => false,
      invoke: async () => ({}),
    },
    '../../features/notifications/services/notificationService': {
      notificationService: {
        notify: (options) => {
          notificationsSent.push(options);
          return Promise.resolve({ delivery: 'sent' });
        },
      },
    },
  }
);

const sanitizeModule = loadWithMocks(
  new URL('../frontend/common/utils/sanitizeHtml.ts', import.meta.url),
  {}
);

const notificationsSent = [];

test('isAllowedImage strictly validates image extensions and MIME types', () => {
  // Valid image files
  assert.equal(imageAttachment.isAllowedImage({ name: 'photo.png', type: 'image/png' }), true);
  assert.equal(imageAttachment.isAllowedImage({ name: 'diagram.jpg', type: 'image/jpeg' }), true);
  assert.equal(imageAttachment.isAllowedImage({ name: 'banner.jpeg', type: 'image/jpeg' }), true);
  assert.equal(imageAttachment.isAllowedImage({ name: 'clip.gif', type: 'image/gif' }), true);
  assert.equal(imageAttachment.isAllowedImage({ name: 'visual.webp', type: 'image/webp' }), true);
  assert.equal(imageAttachment.isAllowedImage({ name: 'vector.svg', type: 'image/svg+xml' }), true);

  // Valid by extension alone (e.g. when drag-and-dropped or OS doesn't provide MIME)
  assert.equal(imageAttachment.isAllowedImage({ name: 'photo.PNG' }), true);
  assert.equal(imageAttachment.isAllowedImage({ name: 'vector.svg' }), true);

  // Strictly rejected non-image files
  assert.equal(imageAttachment.isAllowedImage({ name: 'document.pdf', type: 'application/pdf' }), false);
  assert.equal(imageAttachment.isAllowedImage({ name: 'archive.zip', type: 'application/zip' }), false);
  assert.equal(imageAttachment.isAllowedImage({ name: 'script.sh', type: 'text/x-sh' }), false);
  assert.equal(imageAttachment.isAllowedImage({ name: 'binary.exe', type: 'application/x-msdownload' }), false);
  assert.equal(imageAttachment.isAllowedImage({ name: 'readme.txt', type: 'text/plain' }), false);
  assert.equal(imageAttachment.isAllowedImage({ name: 'notes.md', type: 'text/markdown' }), false);
  assert.equal(imageAttachment.isAllowedImage({}), false);
});

test('sanitizeHtml isSafeUrl allows PNG, JPEG, JPG, GIF, WebP, SVG data URLs and asset protocols', () => {
  const isSafeUrl = sanitizeModule.isSafeUrl;

  // Allowed image data URLs
  assert.equal(isSafeUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==', true), true);
  assert.equal(isSafeUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==', true), true);
  assert.equal(isSafeUrl('data:image/jpg;base64,/9j/4AAQSkZJRg==', true), true);
  assert.equal(isSafeUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', true), true);
  assert.equal(isSafeUrl('data:image/webp;base64,UklGRg==', true), true);
  assert.equal(isSafeUrl('data:image/gif;base64,R0lGODlh', true), true);

  // Allowed asset protocols
  assert.equal(isSafeUrl('asset://localhost/tmp/attachments/photo.png', true), true);
  assert.equal(isSafeUrl('http://asset.localhost/tmp/attachments/photo.png', true), true);
  assert.equal(isSafeUrl('https://asset.localhost/tmp/attachments/photo.png', true), true);

  // Disallowed remote images (per privacy & sandbox guardrails)
  assert.equal(isSafeUrl('https://evil.test/tracker.png', true), false);
  assert.equal(isSafeUrl('http://insecure.test/pic.png', true), false);

  // Disallowed javascript URI in img src
  assert.equal(isSafeUrl('javascript:alert(1)', true), false);
  assert.equal(isSafeUrl('data:text/html;base64,PHNjcmlwdD4=', true), false);
});

test('processAndSaveImage rejects non-image files with guardrail notification', async () => {
  notificationsSent.length = 0;

  const fakePdf = {
    name: 'contract.pdf',
    type: 'application/pdf',
    size: 1024,
  };

  const result = await imageAttachment.processAndSaveImage(fakePdf);
  assert.equal(result, null);
  assert.equal(notificationsSent.length, 1);
  assert.equal(notificationsSent[0].channel, 'guardrails');
  assert.equal(notificationsSent[0].level, 'warning');
  assert.equal(notificationsSent[0].bodyKey, 'attachments.unsupportedBody');
  assert.equal(notificationsSent[0].values.fileName, 'contract.pdf');
});

test('MarkdownEditor renders image attachment input with image-only MIME accept', async (t) => {
  const harness = componentHarness();
  let val = '';
  const { MarkdownEditor } = loadWithMocks(
    new URL('../frontend/common/components/MarkdownEditor.tsx', import.meta.url),
    {
      react: harness.react,
      './MarkdownPreview': { MarkdownPreview: 'Preview' },
      '../utils/shortcuts': { formatShortcutText: (v) => v },
      '../utils/mentions': {
        formatMention: () => '',
        getMentionQuery: () => null,
      },
      '../utils/imageAttachment': imageAttachment,
      '../../features/notifications/services/notificationService': {
        notificationService: {
          notify: (options) => {
            notificationsSent.push(options);
            return Promise.resolve({ delivery: 'sent' });
          },
        },
      },
      ...Object.fromEntries(
        ['Bold', 'Italic', 'Heading', 'Code', 'SquareCode', 'Quote', 'List', 'ListOrdered', 'CheckSquare', 'Link', 'Eye', 'PenLine', 'Sparkles']
          .map((name) => [`./icons/${name}`, { [name]: name }])
      ),
    }
  );

  const rendered = await harness.render(MarkdownEditor, {
    value: val,
    onChange: (next) => { val = next; },
  });
  const nodes = componentNodes(rendered);

  const fileInput = nodes.find((node) => node.props?.['data-testid'] === 'image-attachment-input');
  assert.ok(fileInput, 'Hidden file input for image attachment exists');
  assert.equal(fileInput.props.type, 'file');
  assert.equal(
    fileInput.props.accept,
    'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml'
  );

  const attachButton = nodes.find((node) => node.props?.['aria-label'] === 'Attach images');
  assert.ok(attachButton, 'Attach images button exists');
  assert.equal(attachButton.props.title, 'Attach images (PNG, JPG, GIF, WebP, SVG)');
});

test('MarkdownEditor paste and drop handlers process images and reject non-images', async (t) => {
  const harness = componentHarness();
  let val = '';
  notificationsSent.length = 0;

  const mockImageUtils = {
    ...imageAttachment,
    processAndSaveImage: async (file) => {
      if (!imageAttachment.isAllowedImage(file)) {
        notificationsSent.push({
          channel: 'guardrails',
          level: 'warning',
          body: `File "${file.name}" was rejected. Only image files...`,
        });
        return null;
      }
      return {
        fileName: file.name,
        dataUrl: 'data:image/png;base64,mockpngdata',
        relativePath: `tmp/attachments/${file.name}`,
      };
    },
  };

  const { MarkdownEditor } = loadWithMocks(
    new URL('../frontend/common/components/MarkdownEditor.tsx', import.meta.url),
    {
      react: harness.react,
      './MarkdownPreview': { MarkdownPreview: 'Preview' },
      '../utils/shortcuts': { formatShortcutText: (v) => v },
      '../utils/mentions': {
        formatMention: () => '',
        getMentionQuery: () => null,
      },
      '../utils/imageAttachment': mockImageUtils,
      '../../features/notifications/services/notificationService': {
        notificationService: {
          notify: (options) => {
            notificationsSent.push(options);
            return Promise.resolve({ delivery: 'sent' });
          },
        },
      },
      ...Object.fromEntries(
        ['Bold', 'Italic', 'Heading', 'Code', 'SquareCode', 'Quote', 'List', 'ListOrdered', 'CheckSquare', 'Link', 'Eye', 'PenLine', 'Sparkles']
          .map((name) => [`./icons/${name}`, { [name]: name }])
      ),
    }
  );

  let rendered = await harness.render(MarkdownEditor, {
    value: val,
    onChange: (next) => { val = next; },
  });
  let nodes = componentNodes(rendered);

  const textarea = nodes.find((n) => n.type === 'textarea');
  assert.ok(textarea, 'Textarea exists');

  // Test 1: Paste valid image
  let defaultPrevented = false;
  await textarea.props.onPaste({
    preventDefault: () => { defaultPrevented = true; },
    clipboardData: {
      files: [{ name: 'screenshot.png', type: 'image/png' }],
      items: [],
    },
  });
  assert.equal(defaultPrevented, true);
  assert.equal(val, '![screenshot.png](data:image/png;base64,mockpngdata)');

  // Test 2: Paste non-image file
  val = '';
  defaultPrevented = false;
  await textarea.props.onPaste({
    preventDefault: () => { defaultPrevented = true; },
    clipboardData: {
      files: [{ name: 'archive.zip', type: 'application/zip' }],
      items: [],
    },
  });
  assert.equal(defaultPrevented, true);
  assert.equal(val, ''); // Rejected, not inserted
  assert.equal(notificationsSent.length, 1);
  assert.equal(notificationsSent[0].channel, 'guardrails');

  // Test 3: Drop valid image on dropzone
  val = '';
  const dropzone = nodes.find((n) => n.props?.onDrop);
  assert.ok(dropzone, 'Dropzone exists');

  let dropPrevented = false;
  await dropzone.props.onDrop({
    preventDefault: () => { dropPrevented = true; },
    stopPropagation: () => {},
    dataTransfer: {
      files: [{ name: 'chart.jpg', type: 'image/jpeg' }],
    },
  });
  assert.equal(dropPrevented, true);
  assert.equal(val, '![chart.jpg](data:image/png;base64,mockpngdata)');
});
