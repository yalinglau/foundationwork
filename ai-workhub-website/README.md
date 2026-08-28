# 我的工作台（AI Work Hub）— 獨立網站版

這是從 Claude artifact 版本轉出來的獨立網站版，資料存在 Google Sheets，AI 截圖分析接 OpenAI API。

---

## 你需要準備的東西

1. 一個 Google 帳號（建 Sheet 用）
2. 一個 OpenAI 帳號 + API 金鑰（[platform.openai.com](https://platform.openai.com) 申請，需要綁信用卡，但 AI 截圖分析這種輕量用法一個月大概幾十元台幣內）
3. 一個 Vercel 帳號（免費，[vercel.com](https://vercel.com)，用 GitHub 登入最快）
4. （建議）一個 GitHub 帳號，方便部署與之後請 Claude Code 或其他工具幫你改版

---

## 步驟一：設定 Google Sheets 當資料庫

1. 到 [sheets.google.com](https://sheets.google.com) 開一份新的空白試算表，取個名字（例如「工作台資料庫」）
2. 上方選單：**擴充功能 > Apps Script**
3. 把原本的範例程式碼全部刪掉，貼上 `apps-script/Code.gs` 這個檔案的內容
4. 按右上角「儲存」（磁片圖示）
5. 按「部署」>「新增部署作業」
   - 齒輪選「網頁應用程式」
   - 說明可以隨便填
   - 執行身分：**我**
   - 誰可以存取：**任何人**
6. 按「部署」，第一次會要求你「授權」，照畫面指示允許（會跳出「Google 尚未驗證這個應用程式」的警告，屬正常現象，點「進階」>「前往...（不安全）」即可，因為這是你自己寫的程式）
7. 部署完成後會看到一個網址，結尾是 `/exec`，**把這個網址複製下來**，這就是等一下要填的 `VITE_SHEETS_URL`

**之後如果你修改了 Code.gs**，要記得「部署」>「管理部署作業」>編輯（鉛筆圖示）>版本選「新版本」>部署，網址不會變。

⚠️ 這個網址知道的人都能讀寫這份資料，只在同仁之間分享，不要貼到公開的地方。

---

## 步驟二：申請 OpenAI API 金鑰

1. 到 [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. 建立新的 API 金鑰，複製下來（只會顯示一次，要存好）
3. 到 Billing 頁面加值一點額度（例如 5 美元起）

---

## 步驟三：部署到 Vercel

**最簡單的方式（不用碰指令）：**

1. 把這整個資料夾上傳到一個新的 GitHub repository（可以用 GitHub 網頁版直接拖檔案上傳，或用 GitHub Desktop）
2. 到 [vercel.com](https://vercel.com)，用 GitHub 帳號登入
3. 「Add New」>「Project」，選你剛剛建的 repository
4. 部署設定畫面框架應該會自動偵測成 Vite，不用改
5. 在「Environment Variables」加兩筆：
   - `VITE_SHEETS_URL` = 步驟一拿到的 Apps Script 網址
   - `OPENAI_API_KEY` = 步驟二拿到的金鑰
6. 按「Deploy」，等一兩分鐘完成，會拿到一個網址（例如 `your-project.vercel.app`），這就是要分享給同仁的連結

之後如果請 Claude 幫你改程式碼、把新版檔案上傳回 GitHub，Vercel 會自動重新部署。

---

## 使用方式

- 每個人第一次打開網站，先設定自己的名字（右上角「設定名字」）
- AI 截圖分析預設鎖住，要在「設定」裡的啟用碼功能開通（自己是管理者的話，先在設定裡設一組碼，再輸入同一組碼開通給自己）
- 其他操作跟 Claude 版本一樣：四大項目、所有專案匯出、工作同仁管理都在「設定」裡

---

## 已知的技術眉角

- **多人同時寫入**：Google Sheets 不是為了高併發設計的，如果剛好兩個人在同一秒新增資料，極少數情況可能會有其中一筆漏掉。同仁人數不多的話（幾個人到十幾人）通常沒問題。
- **不是即時同步**：畫面每 30 秒會自動重新整理一次抓最新資料，也可以按右上角的重新整理圖示手動刷新，不是像 Google Docs 那種每個字都即時同步的等級。
- **CORS**：如果同事打開網站後，畫面顯示「無法連線到 Google Sheets」，先檢查 Apps Script 有沒有部署成功、網址有沒有貼對；如果網址正確但還是連不上，把瀏覽器主控台（F12）的錯誤訊息貼給 Claude，可能需要調整 Apps Script 那邊的設定。
- **啟用碼不是真的付款驗證**：跟之前講的一樣，這只是一組共用密碼，技術上懂的人可以繞過，適合內部信任基礎的場景。
