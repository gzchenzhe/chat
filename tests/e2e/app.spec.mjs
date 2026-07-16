import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, '../..');
const exportFixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/export-baseline-state.json'), 'utf8'));

async function openLegacyFixture(page, fixture = exportFixture, url = '/index.html') {
  await page.addInitScript(state => {
    if (sessionStorage.getItem('e2e_fixture_loaded')) return;
    localStorage.removeItem('wechat_editor_state_v18');
    localStorage.removeItem('wechat_editor_state_v19');
    localStorage.setItem('wechat_editor_state_v18', JSON.stringify(state));
    sessionStorage.setItem('e2e_fixture_loaded', '1');
  }, fixture);
  await page.goto(url);
  await expect(page.getByRole('heading', { name: '首页', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('wechat_editor_state_v19')))).toBe(true);
}

async function messageOrder(page) {
  return page.locator('[data-message-id]').evaluateAll(elements => elements.map(element => Number(element.dataset.messageId)));
}

test('migrates v18 state and navigates all three pages', async ({ page }) => {
  await openLegacyFixture(page);

  const stored = await page.evaluate(() => ({
    legacy: localStorage.getItem('wechat_editor_state_v18'),
    current: JSON.parse(localStorage.getItem('wechat_editor_state_v19'))
  }));
  expect(stored.legacy).toBeNull();
  expect(stored.current.schemaVersion).toBe(3);
  expect(stored.current.chatName).toBe('回归测试');
  expect(stored.current.opponents).toHaveLength(3);
  expect(stored.current.opponents[0].name).toBe('测试对象');
  expect(stored.current.messages[1].senderId).toBe('other1');
  expect(stored.current.messages[2].senderId).toBe('me');
  expect(stored.current.messages).toHaveLength(5);

  await page.getByRole('button', { name: '编辑器', exact: true }).click();
  await expect(page.getByRole('heading', { name: '微信截图编辑器', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '预览分享', exact: true }).click();
  await expect(page.getByRole('heading', { name: '预览图分享', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '首页', exact: true }).click();
  await expect(page.getByRole('heading', { name: '首页', exact: true })).toBeVisible();
});

test('uses mirrored elastic width only when text wrapping needs it', async ({ page }) => {
  const standardText = '海力士已跌的不是大力士也不是海公公，只能叫它海狗';
  const elasticText = '海力士已跌的不是大力士,也不是海公公，只能叫它海狗';
  const fixture = {
    ...exportFixture,
    messages: [
      { id: 2001, type: 'text', senderId: 'me', isMe: true, content: standardText },
      { id: 2002, type: 'text', senderId: 'me', isMe: true, content: elasticText },
      { id: 2003, type: 'text', senderId: 'other1', isMe: false, content: elasticText }
    ]
  };

  await openLegacyFixture(page, fixture);
  await page.locator('.pwa-bottom-nav button').nth(2).click();
  const bubbles = page.locator('.wechat-text-message');
  await expect(bubbles).toHaveCount(3);
  await expect(bubbles.nth(0).locator('.wechat-text-line')).toHaveText([
    '海力士已跌的不是大力士也不是',
    '海公公，只能叫它海狗'
  ]);
  await expect(bubbles.nth(1).locator('.wechat-text-line')).toHaveText([
    '海力士已跌的不是大力士,也不是',
    '海公公，只能叫它海狗'
  ]);

  const metrics = await page.locator('#wechat-preview').evaluate(preview => {
    const previewRect = preview.getBoundingClientRect();
    const scale = previewRect.width / preview.offsetWidth;
    return Array.from(preview.querySelectorAll('.wechat-message-row')).map(row => {
      const bubble = row.querySelector('.wechat-text-message');
      const rect = bubble.getBoundingClientRect();
      return {
        side: row.classList.contains('flex-row-reverse') ? 'right' : 'left',
        left: (rect.left - previewRect.left) / scale,
        right: (rect.right - previewRect.left) / scale,
        width: rect.width / scale
      };
    });
  });

  expect(metrics[0].width).toBeCloseTo(255, 1);
  expect(metrics[1].width).toBeGreaterThan(255);
  expect(metrics[1].width).toBeLessThanOrEqual(260);
  expect(metrics[1].right).toBeCloseTo(metrics[0].right, 1);
  expect(metrics[1].left).toBeLessThan(metrics[0].left);
  expect(metrics[2].width).toBeCloseTo(metrics[1].width, 1);
  expect(metrics[2].left).toBeCloseTo(metrics[0].left, 1);
  expect(metrics[2].right).toBeGreaterThan(metrics[0].right);
});

test('keeps desktop line breaks when iOS renders wider glyphs', async ({ page }) => {
  const content = '海力士已跌的不是大力士也不是海公公，只能叫它海狗';
  const fixture = {
    ...exportFixture,
    messages: [
      { id: 2101, type: 'text', senderId: 'other1', isMe: false, content }
    ]
  };

  await openLegacyFixture(page, fixture, '/index.html?iosTextFitTest=1');
  await page.locator('.pwa-bottom-nav button').nth(2).click();

  const lines = page.locator('.wechat-text-message .wechat-text-line');
  await expect(lines).toHaveText([
    '海力士已跌的不是大力士也不是',
    '海公公，只能叫它海狗'
  ]);
  await expect.poll(() => lines.first().evaluate(line => line.style.transform)).toMatch(/^scaleX\(0\./);
});

test('selects named group participants per message and persists the sender', async ({ page }) => {
  await openLegacyFixture(page);

  await page.getByTestId('opponent-name-1').fill('林一');
  await page.getByTestId('opponent-name-2').fill('周二');
  await page.getByTestId('opponent-name-3').fill('陈三');
  const opponent2Avatar = page.locator('img[alt="周二的头像"]');
  const originalOpponent2Avatar = await opponent2Avatar.getAttribute('src');
  await page.getByTestId('opponent-avatar-2').setInputFiles(path.join(root, 'tests/fixtures/avatar-me.png'));
  await expect.poll(() => opponent2Avatar.getAttribute('src')).not.toBe(originalOpponent2Avatar);
  await page.getByRole('button', { name: '编辑器', exact: true }).click();

  const textMessage = page.locator('[data-message-id="1002"]');
  await expect(textMessage.getByRole('radio', { name: '林一', exact: true })).toBeChecked();
  await textMessage.getByRole('radio', { name: '周二', exact: true }).check();
  await expect(textMessage.getByRole('radio', { name: '周二', exact: true })).toBeChecked();

  await page.getByRole('button', { name: '预览分享', exact: true }).click();
  await expect(page.locator('.wechat-message-row .wechat-nickname').first()).toHaveText('周二');
  const previewAvatar = await page.locator('.wechat-message-row .wechat-avatar').first().getAttribute('src');
  const expectedAvatar = await page.locator('img[alt="周二的头像"]').getAttribute('src');
  expect(previewAvatar).toBe(expectedAvatar);

  const storedMessage = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('wechat_editor_state_v19'));
    return state.messages.find(message => message.id === 1002);
  });
  expect(storedMessage.senderId).toBe('other2');
  expect(storedMessage.isMe).toBe(false);
});

test('reorders messages with accessible controls and persists the order', async ({ page }) => {
  await openLegacyFixture(page);
  await page.getByRole('button', { name: '编辑器', exact: true }).click();

  await expect(page.locator('[data-message-id]')).toHaveCount(5);
  expect(await messageOrder(page)).toEqual([1001, 1002, 1003, 1004, 1005]);
  await page.getByRole('button', { name: '下移第 1 条消息', exact: true }).click();
  await expect.poll(() => messageOrder(page)).toEqual([1002, 1001, 1003, 1004, 1005]);
  await page.reload();
  await expect.poll(() => messageOrder(page)).toEqual([1002, 1001, 1003, 1004, 1005]);
});

test('keeps all pages inside a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLegacyFixture(page);

  for (const pageName of ['首页', '编辑器', '预览分享']) {
    await page.getByRole('button', { name: pageName, exact: true }).click();
    await expect.poll(() => page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth
    }))).toEqual({ viewport: 390, documentWidth: 390 });
  }

  const handleTouchAction = await page.locator('.message-drag-handle').evaluateAll(handles =>
    handles.map(handle => getComputedStyle(handle).touchAction)
  );
  expect(handleTouchAction.every(value => value === 'none')).toBe(true);
});

test('generates one export image and downloads a valid backup', async ({ page }) => {
  await openLegacyFixture(page);
  const wechatChatTitle = '健康生活远离股市(8)';
  await page.getByTestId('chat-name-input').fill(wechatChatTitle);
  await page.getByRole('button', { name: '预览分享', exact: true }).click();
  const renderedTitle = page.locator('.wechat-nav-title');
  await expect(renderedTitle).toHaveText(wechatChatTitle);
  await expect.poll(() => renderedTitle.evaluate(element => {
    const frame = element.parentElement.getBoundingClientRect();
    const title = element.getBoundingClientRect();
    const nav = element.closest('.wechat-nav-bar');
    return {
      navHeight: getComputedStyle(nav).height,
      renderedWidth: Math.round(title.width),
      frameWidth: Math.round(frame.width),
      lineHeight: getComputedStyle(element).lineHeight,
      whiteSpace: getComputedStyle(element).whiteSpace,
      transform: getComputedStyle(element).transform
    };
  })).toMatchObject({
    navHeight: '44px',
    lineHeight: '44px',
    whiteSpace: 'nowrap'
  });
  const fittedTitle = await renderedTitle.evaluate(element => ({
    renderedWidth: element.getBoundingClientRect().width,
    frameWidth: element.parentElement.getBoundingClientRect().width,
    inlineTransform: element.style.transform
  }));
  expect(fittedTitle.renderedWidth).toBeLessThanOrEqual(fittedTitle.frameWidth);
  expect(fittedTitle.inlineTransform).toBe('scale(1)');
  await page.getByTestId('generate-image').click();

  const generatedImage = page.getByTestId('generated-image-preview');
  await expect(generatedImage).toBeVisible({ timeout: 70_000 });
  const dimensions = await generatedImage.evaluate(image => ({
    width: image.naturalWidth,
    height: image.naturalHeight,
    source: image.currentSrc.slice(0, 22)
  }));
  expect(dimensions).toEqual({ width: 1125, height: 2436, source: 'data:image/png;base64,' });
  await expect(page.getByTestId('download-generated-image')).toBeVisible();

  await page.getByRole('button', { name: '首页', exact: true }).click();
  const longChatTitle = `${wechatChatTitle}这是一个需要自动缩小但保持完整单行显示的群聊标题`;
  await page.getByTestId('chat-name-input').fill(longChatTitle);
  await page.getByRole('button', { name: '预览分享', exact: true }).click();
  await expect(renderedTitle).toHaveText(longChatTitle);
  await expect.poll(() => renderedTitle.evaluate(element => ({
    fits: element.getBoundingClientRect().width <= element.parentElement.getBoundingClientRect().width,
    inlineTransform: element.style.transform
  }))).toEqual({ fits: true, inlineTransform: expect.not.stringMatching(/^scale\(1\)$/) });

  await page.getByRole('button', { name: '首页', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-backup').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^微信截图备份_\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(backup.format).toBe('wechat-screenshot-pwa-backup');
  expect(backup.version).toBe(1);
  expect(backup.state.schemaVersion).toBe(3);
  expect(backup.state.opponents).toHaveLength(3);
  expect(backup.state.messages).toHaveLength(5);
});
