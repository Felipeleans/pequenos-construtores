(() => {
  const CONFIG = window.PEQUENOS_CLOUD_CONFIG || {};
  const URL = String(CONFIG.url || "").replace(/\/$/, "");
  const KEY = CONFIG.publishableKey || "";
  const SESSION_KEY = "pequenos-construtores-sessao-nuvem-v1";
  const TEAM_CODE_KEY = "pequenos-construtores-codigo-equipe-v1";
  const BASE_KEY = "pequenos-construtores-base-sincronizacao-v1";
  const KEYS = {
    children: "pequenos-construtores-criancas-v1",
    missions: "pequenos-construtores-catalogo-v1",
    records: "pequenos-construtores-registros-v1",
    bonus: "pequenos-construtores-pontos-extras-v1"
  };
  let emAndamento = Promise.resolve();

  function configurado() { return Boolean(URL && KEY && !KEY.includes("PREENCHER")); }
  function lerSessao() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "null"); }
    catch { return null; }
  }
  function salvarSessao(sessao, lembrar = false) {
    const valor = JSON.stringify(sessao);
    if (lembrar) {
      localStorage.setItem(SESSION_KEY, valor);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, valor);
      localStorage.removeItem(SESSION_KEY);
    }
  }
  function limparSessao() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }
  function lerCodigoEquipe() { return localStorage.getItem(TEAM_CODE_KEY) || ""; }
  function salvarCodigoEquipe(code) {
    if (code) localStorage.setItem(TEAM_CODE_KEY, code.trim().toUpperCase());
    else localStorage.removeItem(TEAM_CODE_KEY);
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).filter(key => key !== "sincronizado").sort().map(key => [key, canonical(value[key])]));
  }
  function same(a, b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
  function readArray(key) {
    try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function snapshot() {
    const catalog = (() => { try { return JSON.parse(localStorage.getItem(KEYS.missions) || "{}"); } catch { return {}; } })();
    const missions = Object.entries(catalog).flatMap(([categoryId, list]) => Array.isArray(list) ? list.map(item => ({ ...item, categoryId })) : []);
    return {
      children: readArray(KEYS.children).filter(item => item && !item.nova),
      missions,
      records: readArray(KEYS.records),
      bonus: readArray(KEYS.bonus)
    };
  }
  function rowsKey(rows) { return new Map(rows.map(row => [row.collection + "::" + row.row_id, row])); }
  function currentContents(data) {
    return Object.fromEntries(Object.entries(data).map(([collection, items]) => [
      collection, new Map(items.filter(item => item && item.id != null).map(item => [String(item.id), item]))
    ]));
  }
  function readBase() {
    try { return JSON.parse(localStorage.getItem(BASE_KEY) || "null"); } catch { return null; }
  }
  function writeLocal(data) {
    localStorage.setItem(KEYS.children, JSON.stringify(data.children.filter(item => !item.deleted)));
    localStorage.setItem(KEYS.records, JSON.stringify(data.records.filter(item => !item.deleted).map(item => ({ ...item, sincronizado: true }))));
    localStorage.setItem(KEYS.bonus, JSON.stringify(data.bonus.filter(item => !item.deleted)));
    const catalog = {};
    data.missions.filter(item => !item.deleted).forEach(item => {
      const { categoryId, ...mission } = item;
      (catalog[categoryId] ||= []).push(mission);
    });
    localStorage.setItem(KEYS.missions, JSON.stringify(catalog));
    window.dispatchEvent(new Event("pc-cloud-updated"));
  }
  async function request(path, options = {}, retry = true) {
    if (!configurado()) throw new Error("A conexão compartilhada ainda não foi configurada.");
    const session = lerSessao();
    const headers = { apikey: KEY, "Content-Type": "application/json", ...(options.headers || {}) };
    if (session?.access_token) headers.Authorization = "Bearer " + session.access_token;
    const response = await fetch(URL + path, { ...options, headers });
    if (response.status === 401 && retry && session?.refresh_token) {
      const refreshed = await fetch(URL + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      if (refreshed.ok) {
        const next = await refreshed.json();
        salvarSessao(next, localStorage.getItem(SESSION_KEY) != null);
        return request(path, options, false);
      }
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || "Não foi possível comunicar com o servidor.");
    return payload;
  }
  async function funcao(name, body, authenticated = false) {
    return request("/functions/v1/" + name, { method: "POST", body: JSON.stringify(body), headers: authenticated ? {} : {} });
  }
  async function listarMembros(code) {
    const result = await funcao("list-members", { team_code: code });
    return result;
  }
  async function login(code, name, pin, remember) {
    const result = await funcao("login-pin", { team_code: code, name, pin });
    salvarSessao(result.session, remember);
    salvarCodigoEquipe(code);
    return result;
  }
  async function configurarEquipe(input, lembrar = false) {
    const result = await funcao("setup-team", input);
    salvarSessao(result.session, lembrar);
    salvarCodigoEquipe(result.team_code);
    return result;
  }
  async function adicionarInstrutor(name, pin) {
    return funcao("add-instructor", { name, pin }, true);
  }
  async function solicitarRedefinicao(code) {
    return funcao("request-pin-reset", { team_code: code });
  }
  async function redefinirPin(token, memberId, pin) {
    return request("/functions/v1/reset-pin", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: JSON.stringify({ member_id: memberId, pin })
    });
  }
  async function carregarMembrosAutenticados(token = "") {
    return request("/rest/v1/team_members?select=id,name,role,active&active=eq.true&order=name.asc", {
      headers: token ? { Authorization: "Bearer " + token } : {}
    });
  }
  async function syncOnce() {
    if (!configurado() || !lerSessao()?.access_token || !navigator.onLine) return { synced: false, pending: true };
    const session = lerSessao();
    const teamId = session.user?.app_metadata?.team_id || session.user?.user_metadata?.team_id;
    if (!teamId) throw new Error("A sessão não está vinculada à equipe.");
    const query = "/rest/v1/sync_rows?select=collection,row_id,content,deleted,updated_at&order=updated_at.asc";
    const remote = await request(query);
    const base = readBase();
    const baseMap = rowsKey(base || []);
    const remoteMap = rowsKey(remote || []);
    const local = currentContents(snapshot());
    const remoteData = { children: [], missions: [], records: [], bonus: [] };
    const pending = [];
    const collections = ["children", "missions", "records", "bonus"];

    for (const collection of collections) {
      const ids = new Set([
        ...local[collection].keys(),
        ...[...baseMap.values()].filter(row => row.collection === collection).map(row => row.row_id),
        ...[...remoteMap.values()].filter(row => row.collection === collection).map(row => row.row_id)
      ]);
      for (const id of ids) {
        const key = collection + "::" + id;
        const localItem = local[collection].get(id) || null;
        const baseRow = baseMap.get(key) || null;
        const remoteRow = remoteMap.get(key) || null;
        const localChanged = baseRow
          ? (baseRow.deleted ? !!localItem : !localItem || !same(localItem, baseRow.content))
          : !!localItem;
        const remoteChanged = baseRow
          ? !remoteRow || remoteRow.updated_at !== baseRow.updated_at || remoteRow.deleted !== baseRow.deleted
          : !!remoteRow;
        let chosen = null;
        let chosenDeleted = false;
        let chosenAt = 0;
        let pushChosen = false;

        if (!baseRow) {
          if (remoteRow) { chosen = remoteRow.content; chosenDeleted = remoteRow.deleted; chosenAt = Date.parse(remoteRow.updated_at) || 0; }
          else if (localItem) { chosen = { ...localItem, updatedAt: Date.now() }; chosenAt = Number(chosen.updatedAt); pushChosen = true; }
        } else if (localChanged && remoteChanged) {
          const localAt = Date.now();
          const remoteAt = Date.parse(remoteRow?.updated_at) || 0;
          if (localAt > remoteAt) {
            chosen = localItem ? { ...localItem, updatedAt: localAt } : null;
            chosenDeleted = !localItem; chosenAt = localAt; pushChosen = true;
          }
          else { chosen = remoteRow?.content || null; chosenDeleted = !remoteRow || remoteRow.deleted; chosenAt = remoteAt; }
        } else if (localChanged) {
          const localAt = Date.now();
          if (localItem) chosen = { ...localItem, updatedAt: localAt };
          else chosenDeleted = true;
          chosenAt = localAt; pushChosen = true;
        } else if (remoteRow) {
          chosen = remoteRow.content; chosenDeleted = remoteRow.deleted; chosenAt = Date.parse(remoteRow.updated_at) || 0;
        } else if (localItem) {
          chosen = { ...localItem, updatedAt: Date.now() }; chosenAt = Number(chosen.updatedAt); pushChosen = true;
        }

        if (pushChosen) {
          const row = {
            team_id: teamId, collection, row_id: id, content: chosenDeleted ? null : chosen,
            deleted: chosenDeleted, updated_at: new Date(chosenAt || Date.now()).toISOString()
          };
          pending.push(row);
          remoteMap.set(key, row);
        }
        if (chosen && !chosenDeleted) remoteData[collection].push({ ...chosen, id });
      }
    }

    if (pending.length) {
      await request("/rest/v1/sync_rows?on_conflict=team_id,collection,row_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(pending)
      });
    }
    const fresh = await request(query);
    const freshMap = rowsKey(fresh || []);
    for (const collection of collections) {
      remoteData[collection] = [...freshMap.values()].filter(row => row.collection === collection && !row.deleted).map(row => ({ ...row.content, id: row.row_id }));
    }
    writeLocal(remoteData);
    localStorage.setItem(BASE_KEY, JSON.stringify(fresh || []));
    window.dispatchEvent(new CustomEvent("pc-cloud-synced", { detail: { pending: 0, teamId } }));
    return { synced: true, pending: false, rows: fresh?.length || 0 };
  }
  function sync() {
    emAndamento = emAndamento.then(syncOnce, syncOnce);
    return emAndamento;
  }
  let syncTimer = null;
  function scheduleSync() {
    clearTimeout(syncTimer);
    if (!navigator.onLine || !lerSessao()?.access_token) return;
    syncTimer = setTimeout(() => sync().catch(() => {}), 700);
  }
  window.addEventListener("online", () => sync().catch(() => {}));
  window.PequenosConstrutoresCloud = {
    configurado, lerSessao, salvarSessao, limparSessao, lerCodigoEquipe, salvarCodigoEquipe,
    listarMembros, login, configurarEquipe, adicionarInstrutor, solicitarRedefinicao,
    redefinirPin, carregarMembrosAutenticados, sync, scheduleSync
  };
})();
