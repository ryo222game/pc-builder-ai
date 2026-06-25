export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません' });

  try {
    const { messages, system, max_tokens, use_web_search } = req.body;

    const openaiMessages = [];
    if (system) openaiMessages.push({ role: 'system', content: system });
    openaiMessages.push(...messages);

    // Web検索が必要な場合はgpt-4o-search-previewを使用
    const model = use_web_search ? 'gpt-4o-search-preview' : 'gpt-4o';

    const body = {
      model,
      max_tokens: max_tokens || 1200,
      messages: openaiMessages,
    };

    // Web検索ツールを追加
    if (use_web_search) {
      body.web_search_options = {
        search_context_size: 'high'
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'OpenAI error' });
    }

    const text = data.choices?.[0]?.message?.content || '';
    const converted = {
      content: [{ type: 'text', text }]
    };
    return res.status(200).json(converted);
  } catch (error) {
    console.error('handler error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
