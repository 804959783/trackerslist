// Loon config example:
//
// [Script]
// Bili Live Prophet = type=cron,cronexp=*/2 * * * *,script-path=./bilibili_prophet_loon.js,timeout=30

const REQUEST_URL =
  "https://api.live.bilibili.com/xlive/app-ucenter/v1/elden/get_by_user?access_key=04a91f42c9627ea1aaac64fa97741771CjArbmjIi7_49fcqMZw-OK5T6L--wwtOYX2M8XXVMvCF_cMvj0i_B9DiWcBkpv1ryTESVjRvajVkaXowWTZWYTBIZUVpMlhnN0dKWG41ak1wSXdmX0U1N0szZUlicjkwN1dEdW9wb3d5V2R4cEZtWnRXd2NYOGhtWG81bjhtMm1KSnpaLXFtMldnIIEC&actionKey=appkey&anchor_id=8739477&appkey=27eb53fc9058f8c3&build=86400100&c_locale=zh-Hans_CN&device=pad&disable_rcmd=0&mobi_app=iphone&platform=ios&s_locale=zh-Hans_CN&sign=9e8130ec22dd1829004ddb577c31abc4&statistics=%7B%22appId%22%3A1%2C%22version%22%3A%228.64.0%22%2C%22abtest%22%3A%22%22%2C%22platform%22%3A2%7D&teenagers_age=16&ts=1783049625&uid=6710348&with_history=0";

const REQUEST_HEADERS = {
  "APP-KEY": "iphone",
  Buvid: "YB58D2B5A7ABA97A537999374D8F77461482",
  ENV: "prod",
  GuestId: "42833933114787",
  Session_ID: "ae1d979f",
  "x-bili-aurora-eid": "V1NGUg4=",
  "x-bili-locale-bin":
    "Cg4KAnpoEgRIYW5zGgJDThIOCgJ6aBIESGFucxoCQ04iDUFzaWEvU2hhbmdoYWkqBiswODowMA==",
  "x-bili-metadata-legal-region": "CN",
  "x-bili-mid": "6710348",
  "x-bili-network-bin": "CAEqBQ2WKnE/",
  "x-bili-ticket":
    "eyJhbGciOiJIUzI1NiIsImtpZCI6InMwMyIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODMwNzgyMjEsImlhdCI6MTc4MzA0OTEyMSwicGx0IjoyLCJidXZpZCI6IllCNThEMkI1QTdBQkE5N0E1Mzc5OTkzNzREOEY3NzQ2MTQ4MiJ9.lbBgaDNyqaCMRsk5s_bwLuCRm_OHmwBStKN0qnuj6aE",
  "x-bili-trace-id":
    "196ff354f68835969ccf51fc5c6a472d:9ccf51fc5c6a472d:0:0",
  "User-Agent": "Apifox/1.0.0 (https://apifox.com)",
  Accept: "*/*",
  Host: "api.live.bilibili.com",
  Connection: "keep-alive",
};

const NOTIFY_WHEN_EMPTY = false;
const NOTIFIED_STORAGE_KEY = "bili_live_prophet_notified_ids";
const MAX_NOTIFIED_IDS = 300;

function notify(title, subtitle, body) {
  $notification.post(title, subtitle || "", body || "");
}

function finish(message) {
  if (message) {
    console.log(message);
  }
  $done();
}

function formatTime(seconds) {
  const date = new Date(seconds * 1000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatRemaining(seconds) {
  const diff = Math.max(0, seconds - Math.floor(Date.now() / 1000));
  const minutes = Math.floor(diff / 60);
  const restSeconds = diff % 60;
  if (minutes > 0) {
    return `${minutes}分${restSeconds}秒`;
  }
  return `${restSeconds}秒`;
}

function loadNotifiedIds() {
  const raw = $persistentStore.read(NOTIFIED_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.map(String) : [];
  } catch (error) {
    console.log(`load notified ids failed: ${error}`);
    return [];
  }
}

function saveNotifiedIds(ids) {
  const uniqueIds = Array.from(new Set(ids.map(String))).slice(-MAX_NOTIFIED_IDS);
  $persistentStore.write(JSON.stringify(uniqueIds), NOTIFIED_STORAGE_KEY);
}

function getActiveProphets(payload) {
  const now = Math.floor(Date.now() / 1000);
  const prophets = payload && payload.data && Array.isArray(payload.data.prophets)
    ? payload.data.prophets
    : [];

  return prophets
    .map((item) => item && item.prophet)
    .filter(Boolean)
    .filter((prophet) => {
      const status = Number(prophet.prophet_status);
      const countDownTime = Number(prophet.count_down_time);
      return status === 1 && countDownTime > now;
    });
}

function filterUnnotifiedProphets(activeProphets, notifiedIds) {
  const notifiedSet = new Set(notifiedIds.map(String));
  return activeProphets.filter((prophet) => {
    const prophetId = prophet && prophet.prophet_id;
    return prophetId !== undefined && prophetId !== null && !notifiedSet.has(String(prophetId));
  });
}

function buildNotification(activeProphets) {
  const first = activeProphets[0];
  const title = "B站直播预言进行中";
  const subtitle = `${first.anchor_name || "当前主播"} 有 ${
    activeProphets.length
  } 个预言`;
  const body = activeProphets
    .map((prophet, index) => {
      const question = prophet.question || {};
      const countDownTime = Number(prophet.count_down_time);
      return [
        `${index + 1}. ${question.question || "未知问题"}`,
        `选项: A.${question.answer_a || "-"} / B.${question.answer_b || "-"}`,
        `截止: ${formatTime(countDownTime)}，剩余 ${formatRemaining(countDownTime)}`,
      ].join("\n");
    })
    .join("\n\n");

  return { title, subtitle, body };
}

const request = {
  url: REQUEST_URL,
  headers: REQUEST_HEADERS,
};

$httpClient.get(request, (error, response, body) => {
  if (error) {
    finish(`request error: ${error}`);
    return;
  }

  if (!response || response.status !== 200) {
    const status = response ? response.status : "unknown";
    finish(`unexpected http status: ${status}`);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch (parseError) {
    finish(`json parse error: ${parseError}`);
    return;
  }

  if (payload.code !== 0) {
    finish(`api error: ${payload.code} ${payload.message || ""}`);
    return;
  }

  const activeProphets = getActiveProphets(payload);
  const notifiedIds = loadNotifiedIds();
  const unnotifiedProphets = filterUnnotifiedProphets(activeProphets, notifiedIds);

  if (unnotifiedProphets.length > 0) {
    const notification = buildNotification(unnotifiedProphets);
    notify(notification.title, notification.subtitle, notification.body);
    saveNotifiedIds(
      notifiedIds.concat(unnotifiedProphets.map((prophet) => prophet.prophet_id))
    );
    finish(
      `new active prophets: ${unnotifiedProphets.length}, active prophets: ${activeProphets.length}`
    );
    return;
  }

  if (NOTIFY_WHEN_EMPTY) {
    notify("B站直播预言", "暂无新的进行中预言", "");
  }
  finish(`no new active prophet, active prophets: ${activeProphets.length}`);
});
