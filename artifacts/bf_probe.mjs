import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage();
await p.route('**/api/llm', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: 'x' }) }),
);
await p.goto('http://127.0.0.1:3000/chat');
await p.waitForSelector('#chat-input');
await p.click('#chat-input');
await p.keyboard.type('first line');
await p.keyboard.press('Enter');
await p.keyboard.type('second line');
console.log('VALUE:', JSON.stringify(await p.inputValue('#chat-input')));
console.log('ACTIVE:', await p.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
console.log('MSGS:', await p.locator('.chat-thread .msg').count());
await b.close();
