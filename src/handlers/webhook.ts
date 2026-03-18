interface TelegramUpdate {
  message?: {
    chat: { id: number }
    text?: string
  }
}

export async function handleWebhook(
  request: Request,
  botToken: string,
  appUrl: string
): Promise<Response> {
  const update = (await request.json()) as TelegramUpdate

  if (update.message?.text?.startsWith('/start')) {
    const chatId = update.message.chat.id
    await sendStartMessage(botToken, chatId, appUrl)
  }

  // Always return 200 to Telegram — any non-200 causes repeated retries
  return new Response('ok')
}

async function sendStartMessage(
  token: string,
  chatId: number,
  appUrl: string
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: '🎁 Открой мой вишлист!',
      reply_markup: {
        inline_keyboard: [[
          { text: '🎁 Открыть вишлист', web_app: { url: appUrl } }
        ]],
      },
    }),
  })
}
