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

    const body = {
      model: 'gpt-4o',
      max_tokens: max_tokens || 1200,
      messages: openaiMessages,
    };

    // Web検索が要求された場合はgpt-4o-search-previewを試みる
    if (use_web_search) {
      try {
        const searchRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-search-preview',
            max_tokens: max_tokens || 1200,
            messages: openaiMessages,
            web_search_options: { search_context_size: 'medium' }
          })
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const text = searchData.choices?.[0]?.message?.content || '';
          if (text) {
            return res.status(200).json({ content: [{ type: 'text', text }] });
          }
        }
      } catch(searchErr) {
        console.warn('Web search model failed, falling back to gpt-4o:', searchErr);
      }
    }

    // 通常のgpt-4oで処理
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'OpenAI error' });
    }

    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (error) {
    console.error('handler error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
