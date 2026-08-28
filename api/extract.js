// Vercel Serverless Function — 這段程式碼跑在伺服器端，OPENAI_API_KEY 不會出現在瀏覽器裡。
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "伺服器尚未設定 OPENAI_API_KEY 環境變數" });
    return;
  }

  try {
    const { imageBase64, imageMediaType, noteText, todayStr, weekday } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: "缺少圖片資料" });
      return;
    }

    const instruction = `今天是 ${todayStr}（星期${weekday}）。你是工作擷取助手，任務是從這張截圖（可能是對話截圖、LINE 訊息、Email 等）中找出所有需要被追蹤或執行的具體工作。${noteText ? `\n\n使用者補充說明：${noteText}` : ""}

規則：
- 只找具體、可執行的工作，不要摘要整段對話內容
- bucket 判斷：今天就要處理或已經逾期 → "today"；本週內（不含下週）要處理 → "week"；下週才要處理，或沒有明確急迫性 → "later"；是在等別人回覆、或別人要交付東西給你 → "waiting"
- due_date：內容若有明確日期或相對日期（明天、下週一、8/11 等）要換算成 YYYY-MM-DD，換算不出來就給 null，不要亂猜
- follow_up_date：只有 bucket 是 "waiting" 時才填，代表打算什麼時候去催或確認，沒提到可抓 due_date 前 1-2 天，否則 null
- project：內容中若有提到專案或活動名稱就填，否則給空字串
- assignees：內容若明確指出這件事是誰要負責、誰要去做，就填那些人的名字（陣列，可以有多個），看不出來就給空陣列
- 每項工作給一個 confidence："high" | "medium" | "low"

只回傳一個 JSON 物件，格式為 {"tasks": [{"title":"","project":"","assignees":[],"bucket":"today","due_date":null,"follow_up_date":null,"notes":"","confidence":"high"}]}
如果找不到任何工作，回傳 {"tasks": []}`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              { type: "image_url", image_url: { url: `data:${imageMediaType};base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    const data = await openaiRes.json();
    if (!openaiRes.ok) {
      res.status(openaiRes.status).json({ error: data.error?.message || "OpenAI API 錯誤" });
      return;
    }

    const content = data.choices?.[0]?.message?.content || '{"tasks":[]}';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      res.status(500).json({ error: "AI 回傳的內容不是有效的 JSON" });
      return;
    }

    res.status(200).json({ tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
