import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3000';
const API = 'http://127.0.0.1:8000';
const REPLY_MD = '**Bold** survives markdown\n\n- one\n- two\n\n`code` too';

let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const page = await browser.newPage();

// Mock the server-side model proxy so no API key / network is needed.
let llmDelay = 0;
let llmReply = REPLY_MD;
await page.route('**/api/llm', async (route) => {
  if (llmDelay) await new Promise((r) => setTimeout(r, llmDelay));
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: llmReply }),
  });
});

await page.goto(BASE + '/chat');
await page.waitForSelector('#chat-input');

// --- 1. Enter = newline only -------------------------------------------------
await page.click('#chat-input');
await page.keyboard.type('first line');
await page.keyboard.press('Enter');
await page.keyboard.type('second line');
const val = await page.inputValue('#chat-input');
ok(val.includes('\n') && val.endsWith('second line'), 'Enter inserts a newline, does not send');
ok((await page.locator('.chat-thread .msg').count()) === 0, 'nothing was sent by Enter');
const wrapText = await page.locator('.composer-wrap').textContent();
ok(!wrapText.includes('send ·'), 'old "↵ send · ⇧↵ newline" hint removed');
await page.fill('#chat-input', '');

// --- 2. Stop replaces the spinner and aborts ---------------------------------
llmDelay = 8000;
llmReply = 'this reply must never be stored';
const sessionId = await page.evaluate(() => localStorage.getItem('hmm-session-id'));
const memBefore = await (await fetch(API + '/api/health')).json();

await page.fill('#chat-input', 'stop test message alpha');
await page.click('button[aria-label="Send message"]');
await page.waitForSelector('button[aria-label="Stop generating"]', { timeout: 5000 });
ok(true, 'Stop button replaces the send button while generating');
ok((await page.locator('.spinner').count()) === 0, 'no spinner element remains');
await page.click('button[aria-label="Stop generating"]');
await page.waitForSelector('text=Stopped — no reply was stored', { timeout: 5000 });
ok(true, 'stop toast shown');
await page.waitForSelector('button[aria-label="Send message"]', { timeout: 8000 });
const msgsAfterStop = await page.locator('.chat-thread .msg').count();
ok(msgsAfterStop === 1, `stopped turn leaves only the user message (got ${msgsAfterStop})`);
const hist1 = await (await fetch(`${API}/api/chat/history?session_id=${sessionId}`)).json();
ok(hist1.length === 1 && hist1[0].role === 'user', 'backend history after stop: single user message, no reply stored');
const memAfterStop = await (await fetch(API + '/api/health')).json();
ok(memAfterStop.memory_count >= memBefore.memory_count, 'graph consistent after stop');

// --- 3. Markdown rendering ---------------------------------------------------
llmDelay = 0;
llmReply = REPLY_MD;
await page.fill('#chat-input', 'markdown test question');
await page.click('button[aria-label="Send message"]');
await page.waitForSelector('.msg-assistant .msg-bubble strong', { timeout: 15000 });
const bubbleText = await page.locator('.msg-assistant .msg-bubble').last().textContent();
ok(bubbleText.includes('Bold') && !bubbleText.includes('**'), 'bold rendered as <strong>, raw ** gone');
ok((await page.locator('.msg-assistant .msg-bubble ul li').count()) >= 1, 'markdown list rendered');
ok((await page.locator('.msg-assistant .msg-bubble code').count()) >= 1, 'inline code rendered');

// --- 4. Edit a message, then truncate removes the stale turns ---------------
llmReply = 'Reply to the **edited** question.';
const firstUser = page.locator('.msg-user').first();
await firstUser.hover();
await firstUser.locator('.msg-edit-btn').click();
await page.waitForSelector('.edit-banner', { timeout: 5000 });
ok(true, 'edit banner appears');
const prefill = await page.inputValue('#chat-input');
ok(prefill === 'stop test message alpha', 'composer is prefilled with the original text');
await page.fill('#chat-input', 'edited first question');
await page.click('button[aria-label="Send edited message"]');
await page.waitForSelector('text=stale message', { timeout: 15000 });
const userBubbles = page.locator('.msg-user .msg-bubble');
ok((await userBubbles.count()) === 1, 'old copies removed — exactly one user message remains');
ok((await userBubbles.first().textContent()) === 'edited first question', 'edited text is now the message');
const threadText = await page.locator('.chat-thread').textContent();
ok(!threadText.includes('markdown test question'), 'later stale turns deleted after the edit');
ok(!threadText.includes('stop test message alpha'), 'old copy of the edited message deleted');
const hist2 = await (await fetch(`${API}/api/chat/history?session_id=${sessionId}`)).json();
ok(hist2.length === 2 && hist2[0].content === 'edited first question', 'backend history holds exactly the new turn');

// --- 5. History panel --------------------------------------------------------
await page.click('button:has-text("History")');
await page.waitForSelector('.session-panel', { timeout: 5000 });
const items = page.locator('.session-panel .session-item');
ok((await items.count()) >= 1, 'history panel lists past sessions');
ok((await items.first().textContent()).includes('edited first question'), 'session title reflects the edited first message');

await page.click('button:has-text("New")');
await page.waitForSelector('.chat-empty', { timeout: 5000 });
llmReply = 'new session reply';
await page.fill('#chat-input', 'hello new session');
await page.click('button[aria-label="Send message"]');
await page.waitForSelector('.msg-assistant .msg-bubble', { timeout: 15000 });
await page.click('button:has-text("History")');
await page.waitForSelector('.session-panel', { timeout: 5000 });
ok((await page.locator('.session-panel .session-item').count()) >= 2, 'both sessions listed after starting a new one');
const target = page.locator('.session-panel .session-item', { hasText: 'edited first question' });
await target.click();
await page.waitForSelector('.msg-user .msg-bubble', { timeout: 5000 });
ok((await page.locator('.msg-user .msg-bubble').first().textContent()) === 'edited first question', 'clicking a past session loads its messages');

await page.screenshot({ path: 'artifacts/e2e-chat-final.png' });
await browser.close();

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
