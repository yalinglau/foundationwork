/**
 * AI 工作台 — Google Sheets 後端
 *
 * 使用方式：
 * 1. 開一份新的 Google 試算表
 * 2. 上方選單 擴充功能 > Apps Script
 * 3. 把這個檔案的內容整個貼進去（取代原本的範例程式碼）
 * 4. 按右上角「部署」>「新增部署作業」
 *    - 類型選「網頁應用程式」
 *    - 執行身分：我（你自己的帳號）
 *    - 存取權限：任何人
 * 5. 部署完成後會拿到一個網址（結尾是 /exec），把這個網址填進網站的環境變數 VITE_SHEETS_URL
 *
 * 注意：這個網址知道的人都可以讀寫這份試算表的資料，
 * 不要公開分享到工作同仁以外的地方。
 *
 * 這一版新增：
 * - Users 分頁：存登入用的名字＋密碼雜湊值（前端先用 SHA-256 雜湊過才會送過來，
 *   這裡存的不是明文密碼，但仍建議不要把這份試算表分享給非必要的人）
 * - Settings 分頁多一個 key：boss_name，用來指定誰是老闆帳號
 */

const TASK_HEADERS = ['id','title','project','assignees','bucket','due_date','follow_up_date','notes','confidence','done','done_by','created_at','completed_at','source','created_by','acknowledged_by'];

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const payload = {
    tasks: readTasks(ss),
    projects: readList(ss, 'Projects'),
    colleagues: readList(ss, 'Colleagues'),
    settings: readSettings(ss),
  };
  return jsonResponse(payload);
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' });
  }
  const action = body.action;
  try {
    switch (action) {
      case 'addTask':
        addTaskRow(ss, body.task);
        break;
      case 'updateTask':
        updateTaskRow(ss, body.id, body.patch);
        break;
      case 'deleteTask':
        deleteTaskRow(ss, body.id);
        break;
      case 'addProject':
        addListItem(ss, 'Projects', body.name);
        break;
      case 'removeProject':
        removeListItem(ss, 'Projects', body.name);
        break;
      case 'addColleague':
        addListItem(ss, 'Colleagues', body.name);
        break;
      case 'removeColleague':
        removeListItem(ss, 'Colleagues', body.name);
        break;
      case 'setSetting':
        setSetting(ss, body.key, body.value);
        break;
      case 'signup':
        return jsonResponse(signupUser(ss, body.name, body.password_hash));
      case 'login':
        return jsonResponse(loginUser(ss, body.name, body.password_hash));
      default:
        return jsonResponse({ ok: false, error: 'Unknown action: ' + action });
    }
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers) sh.appendRow(headers);
    return sh;
  }
  if (headers) ensureHeaders(sh, headers);
  return sh;
}

// 幫既有的分頁補上程式碼裡新增、但分頁本身還沒有的欄位（例如舊資料庫沒有 acknowledged_by、done_by 這種後來才加的欄位）
function ensureHeaders(sh, headers) {
  const lastCol = sh.getLastColumn();
  const currentHeaders = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  const missing = headers.filter(h => currentHeaders.indexOf(h) === -1);
  if (missing.length > 0) {
    sh.getRange(1, currentHeaders.length + 1, 1, missing.length).setValues([missing]);
  }
}

function readTasks(ss) {
  const sh = getOrCreateSheet(ss, 'Tasks', TASK_HEADERS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(row => row[0])
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      obj.assignees = obj.assignees ? String(obj.assignees).split('|').filter(Boolean) : [];
      obj.acknowledged_by = obj.acknowledged_by ? String(obj.acknowledged_by).split('|').filter(Boolean) : [];
      obj.done_by = obj.done_by ? String(obj.done_by).split('|').filter(Boolean) : [];
      obj.done = obj.done === true || obj.done === 'true' || obj.done === 'TRUE';
      ['due_date', 'follow_up_date', 'created_at', 'completed_at'].forEach(k => {
        if (obj[k] instanceof Date) {
          obj[k] = Utilities.formatDate(obj[k], Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
        }
      });
      return obj;
    });
}

function addTaskRow(ss, task) {
  const sh = getOrCreateSheet(ss, 'Tasks', TASK_HEADERS);
  const lastCol = sh.getLastColumn();
  const headers = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : TASK_HEADERS;
  const row = headers.map(h => {
    if (h === 'assignees' || h === 'acknowledged_by' || h === 'done_by') return (task[h] || []).join('|');
    if (h === 'done') return !!task.done;
    return task[h] !== undefined && task[h] !== null ? task[h] : '';
  });
  sh.appendRow(row);
}

function updateTaskRow(ss, id, patch) {
  const sh = getOrCreateSheet(ss, 'Tasks', TASK_HEADERS);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id');
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) {
      headers.forEach((h, i) => {
        if (patch[h] !== undefined) {
          let v = patch[h];
          if (h === 'assignees' || h === 'acknowledged_by' || h === 'done_by') v = (v || []).join('|');
          sh.getRange(r + 1, i + 1).setValue(v);
        }
      });
      break;
    }
  }
}

function deleteTaskRow(ss, id) {
  const sh = getOrCreateSheet(ss, 'Tasks', TASK_HEADERS);
  const values = sh.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(id)) {
      sh.deleteRow(r + 1);
      break;
    }
  }
}

function readList(ss, name) {
  const sh = getOrCreateSheet(ss, name, ['name']);
  const values = sh.getDataRange().getValues();
  return values.slice(1).map(r => r[0]).filter(Boolean);
}

function addListItem(ss, name, item) {
  if (!item) return;
  const sh = getOrCreateSheet(ss, name, ['name']);
  const existing = readList(ss, name);
  if (existing.indexOf(item) === -1) sh.appendRow([item]);
}

function removeListItem(ss, name, item) {
  const sh = getOrCreateSheet(ss, name, ['name']);
  const values = sh.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (values[r][0] === item) {
      sh.deleteRow(r + 1);
      break;
    }
  }
}

function readSettings(ss) {
  const sh = getOrCreateSheet(ss, 'Settings', ['key', 'value']);
  const values = sh.getDataRange().getValues();
  const obj = {};
  values.slice(1).forEach(r => { if (r[0]) obj[r[0]] = r[1]; });
  return obj;
}

function setSetting(ss, key, value) {
  const sh = getOrCreateSheet(ss, 'Settings', ['key', 'value']);
  const values = sh.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (values[r][0] === key) {
      sh.getRange(r + 1, 2).setValue(value);
      return;
    }
  }
  sh.appendRow([key, value]);
}

function findUserRow(ss, name) {
  const sh = getOrCreateSheet(ss, 'Users', ['name', 'password_hash']);
  const values = sh.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0]).toLowerCase() === String(name).toLowerCase()) {
      return { row: r + 1, name: values[r][0], password_hash: values[r][1] };
    }
  }
  return null;
}

function signupUser(ss, name, passwordHash) {
  if (!name || !passwordHash) return { ok: false, error: '請輸入名字與密碼' };
  const existing = findUserRow(ss, name);
  if (existing) return { ok: false, error: '這個名字已經有人註冊過了，請改用登入，或換一個名字' };
  const sh = getOrCreateSheet(ss, 'Users', ['name', 'password_hash']);
  sh.appendRow([name, passwordHash]);
  return { ok: true, name: name };
}

function loginUser(ss, name, passwordHash) {
  if (!name || !passwordHash) return { ok: false, error: '請輸入名字與密碼' };
  const existing = findUserRow(ss, name);
  if (!existing) return { ok: false, error: '找不到這個名字，請先註冊' };
  if (String(existing.password_hash) !== String(passwordHash)) {
    return { ok: false, error: '密碼不正確' };
  }
  return { ok: true, name: existing.name };
}
