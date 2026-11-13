const CATEGORIAS = [
  { id: "guardiao", nome: "Guardião da Palavra", icone: "✧", cor: "#4d7656" },
  { id: "explorador", nome: "Explorador", icone: "⌖", cor: "#51798b" },
  { id: "construtor", nome: "Construtor", icone: "⚒", cor: "#bd8841" },
  { id: "servo", nome: "Servo Fiel", icone: "♡", cor: "#81699a" }
];
const LIMITE_CRIANCAS = 30;
const CHAVE = "pequenos-construtores-registros-v1";
const CHAVE_TEMA = "pequenos-construtores-tema-v1";
const CHAVE_DESCRICOES = "pequenos-construtores-descricoes-v1";
const CHAVE_CRIANCAS = "pequenos-construtores-criancas-v1";
const CHAVE_CATALOGO = "pequenos-construtores-catalogo-v1";
const CHAVE_INSTRUTORES = "pequenos-construtores-instrutores-v1";
const CHAVE_LOGIN_AUTOMATICO = "pequenos-construtores-login-automatico-v1";
const CHAVE_REINICIO_CONTAS = "pequenos-construtores-reinicio-contas-v1";
const CHAVE_PONTOS_EXTRAS = "pequenos-construtores-pontos-extras-v1";
try {
  if (localStorage.getItem(CHAVE_REINICIO_CONTAS) !== "concluido") {
    localStorage.removeItem(CHAVE_INSTRUTORES);
    localStorage.setItem(CHAVE_REINICIO_CONTAS, "concluido");
  }
} catch {}
let registros = lerRegistros();
let pontosExtras = lerPontosExtras();
let descricoes = lerDescricoes();
let CRIANCAS = lerCriancas();
let CATALOGO = lerCatalogo();
let instrutores = lerInstrutores();
let usuarioAtual = null;
let criancaSelecionada = "";
let categoriaSelecionada = "";
let registroEditandoId = "";
let criancaNovaId = "";
let retornarAosRegistros = false;
let toastTimer;
let urlsMomentos = [];

function lerRegistros() { try { return JSON.parse(localStorage.getItem(CHAVE) || "[]"); } catch { return []; } }
function lerDescricoes() { try { return JSON.parse(localStorage.getItem(CHAVE_DESCRICOES) || "{}"); } catch { return {}; } }
function lerPontosExtras() { try { const lista = JSON.parse(localStorage.getItem(CHAVE_PONTOS_EXTRAS) || "[]"); return Array.isArray(lista) ? lista.filter(item => item && typeof item.criancaId === "string" && Number.isSafeInteger(item.pontos) && item.pontos > 0) : []; } catch { return []; } }
function lerInstrutores() { try { const lista = JSON.parse(localStorage.getItem(CHAVE_INSTRUTORES) || "[]"); return Array.isArray(lista) ? lista.slice(0, 2) : []; } catch { return []; } }
function salvarPontosExtras() { localStorage.setItem(CHAVE_PONTOS_EXTRAS, JSON.stringify(pontosExtras)); }
function salvarInstrutores() { localStorage.setItem(CHAVE_INSTRUTORES, JSON.stringify(instrutores)); }
function ehInstrutorPrincipal() { return usuarioAtual?.papel === "principal"; }
function renderizarListaInstrutores() {
  const seletor = document.querySelector("#login-name");
  const selecionado = seletor.value;
  seletor.innerHTML = `<option value="">Selecione seu nome</option>${instrutores.map(conta => `<option value="${escapar(conta.nome)}">${escapar(conta.nome)}</option>`).join("")}`;
  seletor.disabled = instrutores.length === 0;
  if (instrutores.some(conta => conta.nome === selecionado)) seletor.value = selecionado;
}
function codificarBase64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
async function derivarSenha(senha, sal) {
  if (!crypto.subtle) throw new Error("Para criar contas, abra o aplicativo por HTTPS ou localhost.");
  const bytesSal = sal ? Uint8Array.from(atob(sal), caractere => caractere.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const resumo = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: bytesSal, iterations: 150000, hash: "SHA-256" }, chave, 256);
  return { sal: codificarBase64(bytesSal), resumo: codificarBase64(resumo) };
}
function abrirSessao(instrutor) {
  usuarioAtual = instrutor;
  document.querySelector("#current-account-label").textContent = `${instrutor.nome} · ${instrutor.papel === "principal" ? "Instrutor principal" : "Instrutor"}`;
  document.querySelector("#welcome-name").textContent = instrutor.nome;
  document.querySelector("#public-home").hidden = true;
  document.querySelector("#login-screen").hidden = true;
  document.querySelector(".topbar").hidden = false;
  document.querySelector("#inicio").hidden = false;
  renderizarDescricaoMissao(); renderizarEditorMissoes(); renderizarHome(); renderizarMomentos();
}
async function cadastrarInstrutor(evento) {
  evento.preventDefault();
  const status = document.querySelector("#register-status");
  const nome = document.querySelector("#register-name").value.trim();
  const senha = document.querySelector("#register-password").value;
  const confirmacao = document.querySelector("#register-confirm").value;
  if (instrutores.length >= 2) { status.textContent = "As duas contas de instrutor já foram cadastradas."; return; }
  if (nome.length < 2) { status.textContent = "Informe o nome do instrutor."; return; }
  if (instrutores.some(item => item.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) { status.textContent = "Esse nome já está cadastrado. Entre com a conta existente."; return; }
  if (!/^\d{4}$/.test(senha)) { status.textContent = "O PIN deve ter exatamente 4 dígitos numéricos."; return; }
  if (senha !== confirmacao) { status.textContent = "As senhas não coincidem."; return; }
  status.textContent = "Criando a conta...";
  try {
    const credencial = await derivarSenha(senha);
    const conta = { id: `instrutor-${Date.now()}`, nome, papel: instrutores.length === 0 ? "principal" : "instrutor", sal: credencial.sal, resumo: credencial.resumo };
    instrutores = [...instrutores, conta];
    salvarInstrutores();
    renderizarListaInstrutores();
    document.querySelector("#register-password").value = "";
    document.querySelector("#register-confirm").value = "";
    abrirSessao(conta);
  } catch (erro) {
    instrutores = lerInstrutores();
    renderizarListaInstrutores();
    status.textContent = erro?.message || "Não foi possível cadastrar a conta neste aparelho.";
  }
}
async function entrarInstrutor(evento) {
  evento.preventDefault();
  const status = document.querySelector("#login-status");
  const nome = document.querySelector("#login-name").value.trim().toLocaleLowerCase("pt-BR");
  const senha = document.querySelector("#login-password").value;
  if (!/^\d{4}$/.test(senha)) { status.textContent = "Digite seu PIN de 4 dígitos."; return; }
  const conta = instrutores.find(item => item.nome.toLocaleLowerCase("pt-BR") === nome);
  if (!conta) { status.textContent = "Conta não encontrada. Confira o nome ou cadastre o instrutor."; return; }
  status.textContent = "Verificando acesso...";
  try {
    const credencial = await derivarSenha(senha, conta.sal);
    if (credencial.resumo !== conta.resumo) { status.textContent = "Senha incorreta. Tente novamente."; return; }
    document.querySelector("#login-password").value = "";
    if (document.querySelector("#remember-login").checked) localStorage.setItem(CHAVE_LOGIN_AUTOMATICO, conta.id);
    else localStorage.removeItem(CHAVE_LOGIN_AUTOMATICO);
    abrirSessao(conta);
  } catch (erro) { status.textContent = erro?.message || "Não foi possível verificar o acesso neste aparelho."; }
}
function alternarAbaAcesso(aba) {
  const cadastro = aba === "cadastro";
  document.querySelector("#login-form").hidden = cadastro;
  document.querySelector("#register-form").hidden = !cadastro;
  document.querySelectorAll(".auth-tab").forEach(botao => botao.classList.toggle("active", botao.dataset.auth === aba));
  document.querySelector("#register-role-hint").textContent = instrutores.length === 0 ? "A primeira conta cadastrada será a instrutora principal." : "A segunda conta será instrutora e poderá consultar as missões.";
  document.querySelector("#register-name").disabled = instrutores.length >= 2;
  document.querySelector("#register-password").disabled = instrutores.length >= 2;
  document.querySelector("#register-confirm").disabled = instrutores.length >= 2;
  document.querySelector("#register-form").querySelector("button[type=submit]").disabled = instrutores.length >= 2;
  document.querySelector('.auth-tab[data-auth="cadastro"]').hidden = instrutores.length >= 2;
}
function lerCriancas() {
  try {
    const salvas = JSON.parse(localStorage.getItem(CHAVE_CRIANCAS) || "null");
    if (!Array.isArray(salvas)) return [];
    return salvas.filter(salva => salva && typeof salva.id === "string" && !registroDeCriancaVazioLegado(salva)).slice(0, LIMITE_CRIANCAS).map(salva => ({
      id: salva.id,
      nome: typeof salva.nome === "string" ? salva.nome : "",
      idade: Math.min(12, Math.max(6, Number(salva.idade) || 6)),
      igreja: typeof salva.igreja === "string" ? salva.igreja : "",
      categoriaRepresentativa: CATEGORIAS.some(categoria => categoria.id === salva.categoriaRepresentativa) ? salva.categoriaRepresentativa : ""
    }));
  } catch { return []; }
}
function registroDeCriancaVazioLegado(crianca) {
  const numero = crianca.id.match(/^crianca-(\d+)$/)?.[1];
  if (!numero) return false;
  const indice = Number(numero) - 1;
  const nomeGerado = `Criança ${numero.padStart(2, "0")}`;
  const idadeGerada = 6 + (indice % 7);
  const temRegistro = registros.some(registro => registro.criancaId === crianca.id);
  return crianca.nome === nomeGerado && Number(crianca.idade) === idadeGerada && !crianca.igreja && !crianca.categoriaRepresentativa && !temRegistro;
}
function lerCatalogo() {
  let salvo = {};
  try { salvo = JSON.parse(localStorage.getItem(CHAVE_CATALOGO) || "{}"); } catch {}
  return Object.fromEntries(CATEGORIAS.map(categoria => [categoria.id, Array.from({ length: 3 }, (_, i) => {
    const padrao = { id: `${categoria.id}-missao-${i + 1}`, nome: `Missão ${i + 1}`, descricao: descricoes[`${categoria.id}::Missão ${i + 1}`] || "" };
    const item = Array.isArray(salvo[categoria.id]) ? salvo[categoria.id][i] : null;
    return item ? { ...padrao, nome: typeof item.nome === "string" && item.nome ? item.nome : padrao.nome, descricao: typeof item.descricao === "string" ? item.descricao : padrao.descricao } : padrao;
  })]));
}
function salvarRegistros() { localStorage.setItem(CHAVE, JSON.stringify(registros)); }
function salvarCatalogo() { localStorage.setItem(CHAVE_CATALOGO, JSON.stringify(CATALOGO)); }
function escapar(texto) { return String(texto).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function iconeBordado(categoria, pequeno = false) {
  const desenhos = {
    guardiao: `<path class="thread-shadow" d="M32 14 44 18v11c0 8-5 14-12 19-7-5-12-11-12-19V18z"/><path class="thread-fill" d="M32 16 42 20v9c0 7-4 12-10 17-6-5-10-10-10-17v-9z"/><path class="thread-light" d="M32 23v14M26 27c2-1 4 0 6 2 2-2 4-3 6-2v12c-2-1-4 0-6 2-2-2-4-3-6-2z"/><path class="thread-gold" d="M32 25v12"/>`,
    explorador: `<circle class="thread-shadow" cx="32" cy="31" r="14"/><circle class="thread-fill" cx="32" cy="31" r="11"/><path class="thread-light" d="m32 18 3.7 10.2L46 32l-10.3 3.7L32 46l-3.7-10.3L18 32l10.3-3.8z"/><path class="thread-gold" d="m32 21 2.1 9-2.1 2-2.1-2zM32 43l-2.1-9 2.1-2 2.1 2z"/>`,
    construtor: `<path class="thread-shadow" d="m21 21 4-4 8 8-4 4zM29 27l4-4 9 9-4 4zM30 29 20 44l3 3 12-13"/><path class="thread-fill" d="m20 20 4-4 8 8-4 4zM28 26l4-4 9 9-4 4z"/><path class="thread-light" d="m30 29 4 4-11 14-4-4z"/><path class="thread-gold" d="m21 20 3-3 7 7-3 3zM30 27l2-2 7 7-2 2z"/>`,
    servo: `<path class="thread-shadow" d="M32 40c-2-2-15-10-15-18a8 8 0 0 1 15-4 8 8 0 0 1 15 4c0 8-13 16-15 18z"/><path class="thread-fill" d="M32 37c-2-2-12-9-12-15a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 6-10 13-12 15z"/><path class="thread-light" d="M18 40c5 1 9 4 14 7 5-3 9-6 14-7M18 40l-3 5 4 4 9-1M46 40l3 5-4 4-9-1"/><path class="thread-gold" d="M20 42c4 2 7 4 12 7 5-3 8-5 12-7"/>`
  };
  return `<svg class="badge-art${pequeno ? " badge-art-small" : ""}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle class="badge-cloth" cx="32" cy="32" r="28"/><circle class="badge-seam" cx="32" cy="32" r="25"/><circle class="badge-inner" cx="32" cy="32" r="21"/>${desenhos[categoria.id] || ""}<circle class="badge-center-stitch" cx="32" cy="32" r="18.5"/></svg>`;
}
function renderizarCriancas(filtro = "") {
  const lista = document.querySelector("#child-list");
  const termo = filtro.trim().toLocaleLowerCase("pt-BR");
  const cadastradas = CRIANCAS.filter(crianca => !crianca.nova);
  const totalCriancas = document.querySelector("#children-count");
  if (totalCriancas) totalCriancas.textContent = `${cadastradas.length}/${LIMITE_CRIANCAS}`;
  const atalhoAdicionar = document.querySelector("#add-child-from-record");
  if (atalhoAdicionar) atalhoAdicionar.disabled = CRIANCAS.length >= LIMITE_CRIANCAS;
  const encontradas = cadastradas.filter(c => `${nomeCrianca(c)} ${c.idade} ${c.igreja} ${CATEGORIAS.find(cat => cat.id === c.categoriaRepresentativa)?.nome || ""} ${c.id}`.toLocaleLowerCase("pt-BR").includes(termo));
  lista.innerHTML = encontradas.length ? encontradas.map(c => {
    const total = totalMissoesConcluidas(c);
    const limite = totalMissoesDisponiveis();
    const representante = CATEGORIAS.find(item => item.id === c.categoriaRepresentativa);
    const emblemas = CATEGORIAS.map(categoria => {
      const concluidas = missoesConcluidas(c, categoria);
      if (!concluidas && categoria.id !== c.categoriaRepresentativa) return "";
      const completas = concluidas >= (CATALOGO[categoria.id] || []).length && concluidas > 0;
      return `<span class="child-completion-emblem ${concluidas ? "earned" : "representative-only"} ${completas ? "complete" : ""}" title="${escapar(categoria.nome)} · ${concluidas} tarefa(s) concluída(s)">${iconeBordado(categoria, true)}</span>`;
    }).join("");
    return `<button type="button" role="option" aria-selected="${criancaSelecionada === c.id}" aria-label="${escapar(nomeCrianca(c))}, ${total} de ${limite} tarefas concluídas${representante ? ` · Categoria representativa: ${escapar(representante.nome)}` : ""}" class="child-option ${criancaSelecionada === c.id ? "selected" : ""} ${total ? "has-progress" : ""}" data-child="${c.id}"><span class="child-option-info"><span class="child-option-name">${escapar(nomeCrianca(c))}</span><small>${total}/${limite} tarefas</small></span><span class="child-option-emblems">${emblemas}</span></button>`;
  }).join("") : `<div class="empty-state">${cadastradas.length ? "Nenhuma criança encontrada." : "Nenhuma criança cadastrada. Use “Adicionar criança” para começar."}</div>`;
  lista.classList.toggle("empty", !encontradas.length);
}
function renderizarCategorias() {
  document.querySelector("#category-list").innerHTML = CATEGORIAS.map(c => `<button type="button" class="category-option ${categoriaSelecionada === c.id ? "selected" : ""}" data-category="${c.id}" aria-pressed="${categoriaSelecionada === c.id}"><span class="category-medallion"><span class="cat-icon">${iconeBordado(c)}</span></span><strong>${c.nome}</strong></button>`).join("");
}
function renderizarMissoes() {
  const select = document.querySelector("#mission-select");
  const missoes = categoriaSelecionada && criancaSelecionada ? (CATALOGO[categoriaSelecionada] || []).filter(m => !registros.some(r => r.id !== registroEditandoId && r.criancaId === criancaSelecionada && r.categoriaId === categoriaSelecionada && (r.missaoId === m.id || (!r.missaoId && r.missao === m.nome)))) : [];
  select.disabled = !categoriaSelecionada || !criancaSelecionada || !missoes.length;
  select.innerHTML = missoes.map(m => `<option value="${m.id}">${escapar(m.nome)}</option>`).join("");
  select.selectedIndex = -1;
  const estado = !criancaSelecionada ? "Selecione uma criança para ver as missões." : !categoriaSelecionada ? "Escolha uma categoria para ver as missões." : !missoes.length ? "Esta criança já concluiu todas as missões desta categoria." : "";
  document.querySelector("#mission-list-status").textContent = estado;
  atualizarBotao();
}
function renderizarDescricaoMissao() {
  const area = document.querySelector("#mission-description-area");
  const missaoId = document.querySelector("#mission-select").value;
  const categoria = CATEGORIAS.find(item => item.id === categoriaSelecionada);
  const ehPrincipal = ehInstrutorPrincipal();
  const missao = categoria ? (CATALOGO[categoria.id] || []).find(item => item.id === missaoId) : null;
  if (!categoria || !missao) {
    area.innerHTML = `<div class="mission-description-empty"><strong>Descrição da missão</strong><p>Escolha uma categoria e uma missão para consultar ou editar sua descrição.</p></div>`;
    return;
  }
  const descricao = missao.descricao || "";
  const descricaoVisivel = descricao ? escapar(descricao).replace(/\n/g, "<br>") : "Esta missão ainda não tem descrição. Somente a Conta 1, do instrutor principal, pode cadastrar ou editar este texto.";
  area.innerHTML = `<div class="mission-description-heading"><div><p class="eyebrow">DESCRIÇÃO DA MISSÃO</p><strong>${escapar(categoria.nome)} · ${escapar(missao.nome)}</strong></div><span class="editor-badge">${ehPrincipal ? "Edição principal" : "Somente leitura"}</span></div>${ehPrincipal ? `<label class="description-label" for="mission-description">Texto da missão</label><textarea id="mission-description" rows="4" maxlength="1200" placeholder="A descrição ainda não foi cadastrada. Escreva aqui os detalhes da missão.">${escapar(descricao)}</textarea><div class="description-actions"><span class="description-status" id="description-status">${descricao ? "Descrição salva neste aparelho." : "Nenhuma descrição cadastrada."}</span><button type="button" class="save-description-button" id="save-description">Salvar descrição</button></div>` : `<p class="description-readonly">${descricaoVisivel}</p>`}`;
  const salvar = area.querySelector("#save-description");
  if (salvar) salvar.addEventListener("click", () => {
    if (!ehInstrutorPrincipal()) return;
    missao.descricao = area.querySelector("#mission-description").value.trim();
    try {
      salvarCatalogo();
      area.querySelector("#description-status").textContent = "Descrição salva neste aparelho.";
      area.querySelector("#description-status").classList.add("saved");
    } catch {
      area.querySelector("#description-status").textContent = "Não foi possível salvar neste aparelho.";
    }
  });
}
function nomeCrianca(crianca) { return crianca.nome.trim() || `Criança ${crianca.id.slice(-2)}`; }
function missoesConcluidas(crianca, categoria) {
  return new Set(registros.filter(registro => registro.criancaId === crianca.id && registro.categoriaId === categoria.id).map(registro => registro.missaoId || `nome:${registro.missao}`)).size;
}
function totalMissoesConcluidas(crianca) { return CATEGORIAS.reduce((total, categoria) => total + missoesConcluidas(crianca, categoria), 0); }
function totalMissoesDisponiveis() { return CATEGORIAS.reduce((total, categoria) => total + (CATALOGO[categoria.id] || []).length, 0); }
function renderizarCadastroCriancas() {
  const editor = document.querySelector("#children-editor");
  editor.innerHTML = CRIANCAS.length ? CRIANCAS.map(crianca => `<div class="child-edit-row ${crianca.nova ? "new-child-row" : ""}"><span class="child-edit-number">#${crianca.id.slice(-2)}</span><label class="child-name-field"><span>Nome</span><input type="text" maxlength="70" data-child-name="${crianca.id}" value="${escapar(crianca.nome)}" placeholder="Nome da criança"></label><label class="child-age-field"><span>Idade</span><select data-child-age="${crianca.id}"><option value="" disabled ${crianca.idade ? "" : "selected"}>Selecione</option>${Array.from({ length: 7 }, (_, i) => `<option value="${i + 6}" ${crianca.idade === i + 6 ? "selected" : ""}>${i + 6} anos</option>`).join("")}</select></label><label class="child-church-field"><span>Igreja</span><input type="text" maxlength="100" data-child-church="${crianca.id}" value="${escapar(crianca.igreja)}" placeholder="Nome da igreja"></label><label class="child-category-field"><span>Categoria representativa</span><select data-child-category="${crianca.id}"><option value="">Sem categoria</option>${CATEGORIAS.map(categoria => `<option value="${categoria.id}" ${crianca.categoriaRepresentativa === categoria.id ? "selected" : ""}>${categoria.nome}</option>`).join("")}</select></label>${crianca.nova ? `<button type="button" class="remove-child-button" data-remove-child="${crianca.id}">Cancelar</button>` : ""}</div>`).join("") : `<div class="empty-state"><span aria-hidden="true">♙</span><p>Nenhuma criança cadastrada ainda. Use “Adicionar criança” para começar.</p></div>`;
  document.querySelectorAll("[data-child-church]").forEach(campo => campo.setAttribute("list", "church-options"));
  renderizarListaIgrejas();
  document.querySelector("#add-child").disabled = CRIANCAS.length >= LIMITE_CRIANCAS;
  document.querySelector("#save-children").disabled = !CRIANCAS.length;
  renderizarCriancas(document.querySelector("#child-search").value);
}
function adicionarCrianca() {
  if (CRIANCAS.length >= LIMITE_CRIANCAS) { document.querySelector("#children-feedback").textContent = "O grupo já atingiu o limite de 30 crianças."; return; }
  const usados = new Set(CRIANCAS.map(crianca => Number(crianca.id.match(/(\d+)$/)?.[1])).filter(Boolean));
  let numero = 1; while (usados.has(numero) && numero <= LIMITE_CRIANCAS) numero++;
  const id = `crianca-${String(numero).padStart(2, "0")}`;
  CRIANCAS.push({ id, nome: "", idade: 0, igreja: "", categoriaRepresentativa: "", nova: true });
  criancaNovaId = id;
  renderizarCadastroCriancas();
  document.querySelector(`[data-child-name="${id}"]`).focus();
}
function cancelarNovaCrianca(id) {
  const crianca = CRIANCAS.find(item => item.id === id);
  if (!crianca?.nova) return;
  CRIANCAS = CRIANCAS.filter(item => item.id !== id);
  if (criancaNovaId === id) { criancaNovaId = ""; retornarAosRegistros = false; }
  renderizarCadastroCriancas();
}
function renderizarListaIgrejas() {
  const nomes = new Map();
  const adicionar = nome => { const texto = String(nome || "").trim(); if (texto && !nomes.has(texto.toLocaleLowerCase("pt-BR"))) nomes.set(texto.toLocaleLowerCase("pt-BR"), texto); };
  CRIANCAS.forEach(crianca => adicionar(crianca.igreja));
  document.querySelectorAll("[data-child-church]").forEach(campo => adicionar(campo.value));
  document.querySelector("#church-options").innerHTML = [...nomes.values()].sort((a, b) => a.localeCompare(b, "pt-BR")).map(nome => `<option value="${escapar(nome)}"></option>`).join("");
}
function salvarCadastroCriancas() {
  const valores = CRIANCAS.map(crianca => ({
    crianca,
    nome: document.querySelector(`[data-child-name="${crianca.id}"]`).value.trim(),
    idade: Number(document.querySelector(`[data-child-age="${crianca.id}"]`).value),
    igreja: document.querySelector(`[data-child-church="${crianca.id}"]`).value.trim(),
    categoriaRepresentativa: document.querySelector(`[data-child-category="${crianca.id}"]`).value
  }));
  const semNome = valores.find(item => !item.nome);
  if (semNome) {
    document.querySelector("#children-feedback").textContent = "Informe o nome de cada criança antes de salvar.";
    document.querySelector(`[data-child-name="${semNome.crianca.id}"]`).focus();
    return;
  }
  const idadeInvalida = valores.find(item => item.idade < 6 || item.idade > 12);
  if (idadeInvalida) {
    document.querySelector("#children-feedback").textContent = "Escolha uma idade entre 6 e 12 anos para cada criança.";
    document.querySelector(`[data-child-age="${idadeInvalida.crianca.id}"]`).focus();
    return;
  }
  valores.forEach(item => Object.assign(item.crianca, { nome: item.nome, idade: item.idade, igreja: item.igreja, categoriaRepresentativa: item.categoriaRepresentativa }));
  try {
    const persistidas = CRIANCAS.map(({ nova, ...crianca }) => crianca);
    localStorage.setItem(CHAVE_CRIANCAS, JSON.stringify(persistidas));
    CRIANCAS = persistidas;
    const idRecemCadastrada = criancaNovaId;
    criancaNovaId = "";
    renderizarCadastroCriancas(); renderizarCriancas(document.querySelector("#child-search").value);
    renderizarProgresso(document.querySelector("#progress-search").value);
    document.querySelector("#children-feedback").textContent = "Cadastro das crianças salvo neste aparelho.";
    if (retornarAosRegistros && idRecemCadastrada) {
      const novaCrianca = CRIANCAS.find(crianca => crianca.id === idRecemCadastrada);
      retornarAosRegistros = false;
      if (novaCrianca) {
        mostrarArea("view-dashboard"); criancaSelecionada = novaCrianca.id;
        document.querySelector("#child-search").value = nomeCrianca(novaCrianca);
        renderizarCriancas(nomeCrianca(novaCrianca)); renderizarMissoes(); renderizarDescricaoMissao();
      }
    }
  } catch { document.querySelector("#children-feedback").textContent = "Não foi possível salvar o cadastro neste aparelho."; }
}
function renderizarEditorMissoes() {
  const ehPrincipal = ehInstrutorPrincipal();
  document.querySelector("#mission-editor-role").textContent = ehPrincipal ? "Edição pela Conta 1" : "Somente leitura";
  document.querySelector("#missions-editor").innerHTML = CATEGORIAS.map(categoria => `<section class="mission-category-panel"><div class="mission-category-heading"><span class="cat-icon">${iconeBordado(categoria, true)}</span><h2>${escapar(categoria.nome)}</h2></div><div class="mission-admin-grid">${(CATALOGO[categoria.id] || []).map((missao, indice) => `<article class="mission-admin-card"><p class="eyebrow">MISSÃO ${indice + 1}</p><label>Nome da missão<input type="text" maxlength="80" data-mission-name="${missao.id}" value="${escapar(missao.nome)}" ${ehPrincipal ? "" : "readonly"}></label><label>Descrição<textarea rows="3" maxlength="1200" data-mission-description="${missao.id}" ${ehPrincipal ? "" : "readonly"} placeholder="${ehPrincipal ? "Descreva os detalhes desta missão." : "Ainda sem descrição."}">${escapar(missao.descricao)}</textarea></label><button class="save-description-button" type="button" data-save-mission="${missao.id}" data-category="${categoria.id}" ${ehPrincipal ? "" : "disabled"}>Salvar missão</button></article>`).join("")}</div></section>`).join("");
}
function salvarMissao(categoriaId, missaoId) {
  if (!ehInstrutorPrincipal()) return;
  const missao = (CATALOGO[categoriaId] || []).find(item => item.id === missaoId);
  if (!missao) return;
  const novoNome = document.querySelector(`[data-mission-name="${missaoId}"]`).value.trim();
  if (!novoNome) { document.querySelector("#missions-feedback").textContent = "Informe um nome para a missão."; return; }
  missao.nome = novoNome;
  missao.descricao = document.querySelector(`[data-mission-description="${missaoId}"]`).value.trim();
  try {
    salvarCatalogo();
    renderizarEditorMissoes(); renderizarMissoes(); renderizarDescricaoMissao();
    document.querySelector("#missions-feedback").textContent = "Nome e descrição da missão salvos neste aparelho.";
  } catch { document.querySelector("#missions-feedback").textContent = "Não foi possível salvar esta missão neste aparelho."; }
}
function mostrarArea(id) {
  document.querySelectorAll(".app-view").forEach(area => { area.hidden = area.id !== id; area.classList.toggle("active", area.id === id); });
  document.querySelectorAll(".section-tab").forEach(botao => botao.classList.toggle("active", botao.dataset.view === id));
  if (id === "view-home") { renderizarHome(); renderizarMomentos(); }
  if (id === "view-children") renderizarCadastroCriancas();
  if (id === "view-progress") renderizarProgresso();
  if (id === "view-podium") renderizarPodio();
  if (id === "view-missions") renderizarEditorMissoes();
}
function atualizarBotao() {
  const botao = document.querySelector("#save-button");
  botao.disabled = !(criancaSelecionada && categoriaSelecionada && document.querySelector("#mission-select").value);
  botao.innerHTML = registroEditandoId ? `<span aria-hidden="true">✓</span> Salvar alterações` : `<span aria-hidden="true">✓</span> Validar e salvar registro`;
  document.querySelector("#cancel-edit").hidden = !registroEditandoId;
  atualizarProgresso();
}
function atualizarProgresso() {
  const etapas = [...document.querySelectorAll("#registration-progress li")];
  const temMissao = Boolean(document.querySelector("#mission-select").value);
  const etapaAtual = temMissao ? 3 : categoriaSelecionada ? 2 : criancaSelecionada ? 1 : 0;
  etapas.forEach((etapa, indice) => {
    const ativa = indice === etapaAtual;
    etapa.classList.toggle("active", ativa);
    etapa.classList.toggle("completed", indice < etapaAtual);
    etapa.setAttribute("aria-current", ativa ? "step" : "false");
    etapa.dataset.status = ativa ? "atual" : indice < etapaAtual ? "concluida" : "pendente";
  });
  const proporcao = etapas.length > 1 ? etapaAtual / (etapas.length - 1) : 0;
  document.querySelector("#registration-progress").style.setProperty("--progress", `${proporcao * 84}%`);
}
function renderizarResumo() {
  const resumo = document.querySelector("#category-summary");
  resumo.innerHTML = CATEGORIAS.map(cat => {
    const total = registros.filter(r => r.categoriaId === cat.id).length;
    return `<div class="summary-row"><span class="cat-icon">${iconeBordado(cat, true)}</span><div><strong>${cat.nome}</strong><small>conquistas registradas</small></div><b>${total}</b></div>`;
  }).join("");
}
function renderizarHome() {
  const cadastradas = CRIANCAS.filter(crianca => !crianca.nova);
  document.querySelector("#home-children-count").textContent = `${cadastradas.length}/${LIMITE_CRIANCAS}`;
  document.querySelector("#home-record-count").textContent = String(registros.length);
  document.querySelector("#home-pending-count").textContent = String(registros.filter(registro => !registro.sincronizado).length);
  document.querySelector("#home-category-summary").innerHTML = CATEGORIAS.map(categoria => {
    const total = registros.filter(registro => registro.categoriaId === categoria.id).length;
    return `<article class="home-category-summary-card"><span class="home-summary-emblem">${iconeBordado(categoria, true)}</span><div><h3>${escapar(categoria.nome)}</h3><p>${total} ${total === 1 ? "conquista registrada" : "conquistas registradas"}</p></div></article>`;
  }).join("");
}
function abrirBancoMomentos() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error("Este navegador não permite guardar mídias locais.")); return; }
    const pedido = window.indexedDB.open("pequenos-construtores-momentos", 1);
    pedido.onupgradeneeded = () => { if (!pedido.result.objectStoreNames.contains("momentos")) pedido.result.createObjectStore("momentos", { keyPath: "id" }); };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error || new Error("Não foi possível abrir a galeria local."));
  });
}
async function operarBancoMomentos(modo, operacao, valor) {
  const banco = await abrirBancoMomentos();
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction("momentos", modo);
    const loja = transacao.objectStore("momentos");
    const pedido = operacao === "listar" ? loja.getAll() : operacao === "salvar" ? loja.put(valor) : loja.delete(valor);
    let resultado;
    pedido.onsuccess = () => { resultado = pedido.result; };
    pedido.onerror = () => reject(pedido.error || new Error("Não foi possível acessar a galeria local."));
    transacao.oncomplete = () => { banco.close(); resolve(resultado); };
    transacao.onerror = () => { banco.close(); reject(transacao.error || new Error("Não foi possível salvar a mídia.")); };
    transacao.onabort = () => { banco.close(); reject(transacao.error || new Error("A ação na galeria foi cancelada.")); };
  });
}
function escaparAtributo(valor) { return escapar(valor).replace(/`/g, "&#96;"); }
async function renderizarMomentos() {
  const galeria = document.querySelector("#memories-gallery");
  const status = document.querySelector("#memories-status");
  urlsMomentos.forEach(url => URL.revokeObjectURL(url));
  urlsMomentos = [];
  try {
    const momentos = await operarBancoMomentos("readonly", "listar");
    const ordenados = momentos.sort((a, b) => b.criadoEm - a.criadoEm);
    if (!ordenados.length) { galeria.innerHTML = `<div class="memories-empty"><span aria-hidden="true">✦</span><p>Suas fotos e vídeos das atividades aparecerão aqui.</p></div>`; return; }
    galeria.innerHTML = ordenados.map(momento => {
      const url = URL.createObjectURL(momento.arquivo);
      urlsMomentos.push(url);
      const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(momento.criadoEm);
      const midia = momento.tipo === "video" ? `<video src="${escaparAtributo(url)}" controls playsinline preload="metadata" aria-label="Vídeo: ${escaparAtributo(momento.nome)}"></video>` : `<img src="${escaparAtributo(url)}" alt="${escaparAtributo(momento.nome)}" loading="lazy">`;
      return `<article class="memory-card"><div class="memory-preview">${midia}</div><div class="memory-card-footer"><span><strong>${escapar(momento.nome)}</strong><small>${data}</small></span><button class="memory-delete-button" type="button" data-delete-memory="${escaparAtributo(momento.id)}" aria-label="Remover ${escaparAtributo(momento.nome)}">Remover</button></div></article>`;
    }).join("");
    status.textContent = `${ordenados.length} ${ordenados.length === 1 ? "momento salvo" : "momentos salvos"} neste aparelho.`;
  } catch (erro) {
    galeria.innerHTML = `<div class="memories-empty"><p>Não foi possível abrir a galeria neste navegador.</p></div>`;
    status.textContent = erro?.message || "A galeria local não está disponível.";
  }
}
async function salvarArquivosDeMomentos(arquivos) {
  const status = document.querySelector("#memories-status");
  const botao = document.querySelector("#add-memories-button");
  let salvos = 0;
  botao.disabled = true;
  status.textContent = "Salvando fotos e vídeos neste aparelho…";
  try {
    for (const arquivo of arquivos) {
      if (!arquivo.type.startsWith("image/") && !arquivo.type.startsWith("video/")) continue;
      await operarBancoMomentos("readwrite", "salvar", { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, nome: arquivo.name, tipo: arquivo.type.startsWith("video/") ? "video" : "imagem", mime: arquivo.type, criadoEm: Date.now(), arquivo });
      salvos++;
    }
    await renderizarMomentos();
    status.textContent = salvos ? `${salvos} ${salvos === 1 ? "arquivo salvo" : "arquivos salvos"} neste aparelho.` : "Selecione arquivos de imagem ou vídeo.";
  } catch (erro) {
    await renderizarMomentos();
    status.textContent = salvos ? `${salvos} arquivos salvos. ${erro?.message || "Um dos arquivos não pôde ser salvo."}` : erro?.message || "Não foi possível salvar os arquivos neste aparelho.";
  } finally {
    botao.disabled = false;
    document.querySelector("#memories-input").value = "";
  }
}
async function removerMomento(id) {
  const galeria = document.querySelector("#memories-gallery");
  const item = galeria.querySelector(`[data-delete-memory="${id}"]`);
  const nome = item?.getAttribute("aria-label")?.replace("Remover ", "") || "este arquivo";
  if (!window.confirm(`Remover ${nome} da galeria deste aparelho?`)) return;
  try { await operarBancoMomentos("readwrite", "excluir", id); await renderizarMomentos(); document.querySelector("#memories-status").textContent = "Arquivo removido da galeria."; }
  catch (erro) { document.querySelector("#memories-status").textContent = erro?.message || "Não foi possível remover este arquivo."; }
}
function renderizarCategoriasPublicas() {
  const descricoes = {
    guardiao: "Conhecer e guardar ensinamentos bíblicos.",
    explorador: "Descobrir, observar e aprender com curiosidade.",
    construtor: "Colocar boas ideias em prática com dedicação.",
    servo: "Demonstrar cuidado, fé e serviço ao próximo."
  };
  document.querySelector("#public-home-categories").innerHTML = CATEGORIAS.map(categoria => `<article><span class="category-medallion home-public-medallion"><span class="cat-icon">${iconeBordado(categoria)}</span></span><h3>${escapar(categoria.nome)}</h3><p>${descricoes[categoria.id]}</p></article>`).join("");
}
function pontosDeMissoes(criancaId) { return registros.filter(registro => registro.criancaId === criancaId).length; }
function pontosExtrasDaCrianca(criancaId) { return pontosExtras.filter(registro => registro.criancaId === criancaId).reduce((total, registro) => total + registro.pontos, 0); }
function pontuacaoDaCrianca(criancaId) { return pontosDeMissoes(criancaId) + pontosExtrasDaCrianca(criancaId); }
function renderizarPodio() {
  const criancas = CRIANCAS.filter(crianca => !crianca.nova).map(crianca => ({
    ...crianca,
    pontosMissoes: pontosDeMissoes(crianca.id),
    pontosExtras: pontosExtrasDaCrianca(crianca.id)
  })).sort((a, b) => (b.pontosMissoes + b.pontosExtras) - (a.pontosMissoes + a.pontosExtras) || b.pontosMissoes - a.pontosMissoes || nomeCrianca(a).localeCompare(nomeCrianca(b), "pt-BR"));
  const medalhas = ["🥇", "🥈", "🥉"];
  const palco = document.querySelector("#podium-stage");
  palco.innerHTML = criancas.length ? criancas.slice(0, 3).map((crianca, indice) => `<article class="podium-winner rank-${indice + 1}"><div class="podium-winner-info"><span class="podium-medal" aria-hidden="true">${medalhas[indice]}</span><strong>${escapar(nomeCrianca(crianca))}</strong><b>${crianca.pontosMissoes + crianca.pontosExtras} <small>pontos</small></b></div><div class="podium-step">${indice + 1}º lugar</div></article>`).join("") : `<div class="empty-state"><p>Cadastre uma criança para começar o pódio.</p></div>`;
  const ranking = document.querySelector("#podium-ranking");
  ranking.innerHTML = criancas.length ? `<div class="podium-ranking-heading"><span>Pos.</span><span>Criança</span><span>Missões</span><span>Extras</span><span>Total</span></div>${criancas.map((crianca, indice) => `<div class="podium-ranking-row"><b class="podium-position">${indice + 1}º</b><strong>${escapar(nomeCrianca(crianca))}</strong><span>${crianca.pontosMissoes}</span><span>${crianca.pontosExtras}</span><b class="podium-total">${crianca.pontosMissoes + crianca.pontosExtras}</b></div>`).join("")}` : "";
  const seletor = document.querySelector("#bonus-child");
  const selecionada = seletor.value;
  seletor.innerHTML = `<option value="">Selecione uma criança</option>${criancas.slice().sort((a, b) => nomeCrianca(a).localeCompare(nomeCrianca(b), "pt-BR")).map(crianca => `<option value="${escapar(crianca.id)}">${escapar(nomeCrianca(crianca))}</option>`).join("")}`;
  if (criancas.some(crianca => crianca.id === selecionada)) seletor.value = selecionada;
  seletor.disabled = criancas.length === 0;
  document.querySelector("#bonus-submit").disabled = criancas.length === 0;
  const termo = document.querySelector("#bonus-history-search").value.trim().toLocaleLowerCase("pt-BR");
  const encontradas = CRIANCAS.filter(crianca => !crianca.nova && `${nomeCrianca(crianca)} ${crianca.igreja || ""}`.toLocaleLowerCase("pt-BR").includes(termo));
  document.querySelector("#bonus-points-summary").innerHTML = termo ? encontradas.length ? encontradas.map(crianca => {
    const missoes = pontosDeMissoes(crianca.id);
    const extras = pontosExtrasDaCrianca(crianca.id);
    return `<article class="bonus-points-result"><div><strong>${escapar(nomeCrianca(crianca))}</strong><small>${escapar(crianca.igreja || "Igreja não informada")}</small></div><span>Pontos das missões <b>${missoes}</b></span><span>Pontos extras <b>${extras}</b></span><strong class="bonus-points-total">Total <b>${missoes + extras}</b></strong></article>`;
  }).join("") : `<div class="empty-state"><p>Nenhuma criança encontrada. Confira o nome ou a igreja.</p></div>` : `<div class="empty-state"><p>Pesquise uma criança para consultar os pontos das missões, os extras e o total.</p></div>`;
  const idsEncontrados = new Set(encontradas.map(crianca => crianca.id));
  const historico = [...pontosExtras].sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0)).filter(registro => !termo || idsEncontrados.has(registro.criancaId));
  document.querySelector("#bonus-history-count").textContent = String(historico.length);
  document.querySelector("#bonus-history-list").innerHTML = historico.length ? historico.map(registro => {
    const crianca = CRIANCAS.find(item => item.id === registro.criancaId);
    const data = registro.criadoEm ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(registro.criadoEm) : "";
    return `<article class="bonus-history-item"><span class="bonus-history-points">+${registro.pontos}<small> pts</small></span><div class="bonus-history-detail"><strong>${escapar(crianca ? nomeCrianca(crianca) : "Criança não cadastrada")}</strong><p>${escapar(registro.motivo || "Sem motivo informado")}</p><small>${escapar(registro.instrutorNome || "Instrutor")}${data ? ` · ${data}` : ""}</small></div></article>`;
  }).join("") : `<div class="empty-state"><p>${termo && encontradas.length ? "Esta criança ainda não recebeu pontos extras." : termo ? "Não há pontos extras para o resultado da busca." : "Os pontos extras concedidos aparecerão aqui, com o motivo e a data."}</p></div>`;
}
function registrarPontosExtras(evento) {
  evento.preventDefault();
  const crianca = CRIANCAS.find(item => item.id === document.querySelector("#bonus-child").value && !item.nova);
  const pontos = Number(document.querySelector("#bonus-points").value);
  const feedback = document.querySelector("#bonus-feedback");
  if (!crianca) { feedback.textContent = "Selecione uma criança cadastrada."; return; }
  if (!Number.isSafeInteger(pontos) || pontos < 1) { feedback.textContent = "Informe uma quantidade inteira de pontos maior que zero."; return; }
  pontosExtras.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, criancaId: crianca.id, pontos, motivo: document.querySelector("#bonus-reason").value.trim(), instrutorNome: usuarioAtual?.nome || "", criadoEm: Date.now() });
  try { salvarPontosExtras(); }
  catch { pontosExtras.pop(); feedback.textContent = "Não foi possível salvar os pontos extras neste aparelho."; return; }
  document.querySelector("#bonus-form").reset();
  feedback.textContent = `${pontos} ${pontos === 1 ? "ponto extra concedido" : "pontos extras concedidos"} para ${nomeCrianca(crianca)}.`;
  renderizarPodio();
  mostrarToast("Pontos extras adicionados ao pódio!");
}
function renderizarProgresso(filtro = document.querySelector("#progress-search").value) {
  const termo = filtro.trim().toLocaleLowerCase("pt-BR");
  const encontradas = CRIANCAS.filter(crianca => !crianca.nova && `${nomeCrianca(crianca)} ${crianca.idade} ${crianca.igreja} ${CATEGORIAS.find(cat => cat.id === crianca.categoriaRepresentativa)?.nome || ""}`.toLocaleLowerCase("pt-BR").includes(termo));
  const lista = document.querySelector("#children-progress");
  if (!encontradas.length) { lista.innerHTML = `<div class="empty-state"><p>Nenhuma criança encontrada.</p></div>`; return; }
  lista.innerHTML = encontradas.map(crianca => {
    const representativa = CATEGORIAS.find(categoria => categoria.id === crianca.categoriaRepresentativa);
    const detalhes = CATEGORIAS.map(categoria => {
      const missoes = CATALOGO[categoria.id] || [];
      const concluidas = missoesConcluidas(crianca, categoria);
      const total = missoes.length;
      const porcentagem = total ? Math.min(100, Math.round(concluidas / total * 100)) : 0;
      const medalhaStatus = concluidas >= total && total ? "complete" : concluidas ? "earned" : "pending";
      return `<div class="child-progress-category"><div class="child-progress-label"><span class="child-progress-name"><span class="progress-category-emblem ${medalhaStatus}">${iconeBordado(categoria, true)}</span><strong>${escapar(categoria.nome)}</strong></span><span class="child-progress-count">${Math.min(concluidas, total)}/${total}</span></div><div class="child-progress-track" role="progressbar" aria-label="Progresso em ${escapar(categoria.nome)}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${Math.min(concluidas, total)}"><i style="width:${porcentagem}%"></i></div></div>`;
    }).join("");
    const totalConcluidas = totalMissoesConcluidas(crianca);
    const totalMissoes = CATEGORIAS.reduce((soma, categoria) => soma + (CATALOGO[categoria.id] || []).length, 0);
    const nomeDestaque = totalConcluidas ? "has-progress" : "";
    const progressoCompleto = totalConcluidas >= totalMissoes ? "complete" : "";
    return `<article class="child-progress-card"><div class="child-progress-card-heading"><div class="child-progress-person"><span class="progress-child-avatar ${nomeDestaque} ${progressoCompleto}">${escapar(crianca.id.slice(-2))}</span><div class="child-progress-person-info"><div class="child-progress-name-line ${nomeDestaque} ${progressoCompleto}"><h3>${escapar(nomeCrianca(crianca))}</h3>${representativa ? `<span class="child-representative-mark" title="Categoria representativa: ${escapar(representativa.nome)}">${iconeBordado(representativa, true)}</span>` : ""}</div><p>${crianca.idade} anos · ${escapar(crianca.igreja || "Igreja não informada")}</p></div></div><strong class="child-progress-total ${nomeDestaque} ${progressoCompleto}">${Math.min(totalConcluidas, totalMissoes)}<small>/${totalMissoes}</small></strong></div><div class="child-progress-categories">${detalhes}</div></article>`;
  }).join("");
}
function renderizarRegistros() {
  const recent = document.querySelector("#recent-list");
  const maisRecentes = [...registros].sort((a, b) => b.criadoEm - a.criadoEm);
  document.querySelector("#recent-count").textContent = String(registros.length);
  document.querySelector("#today-count").textContent = String(registros.length);
  document.querySelector("#pending-count").textContent = String(registros.filter(r => !r.sincronizado).length);
  if (!maisRecentes.length) { recent.innerHTML = `<div class="empty-state"><span aria-hidden="true">✦</span><p>Os registros salvos aparecerão aqui.</p></div>`; return; }
  recent.innerHTML = maisRecentes.map(r => { const cat = CATEGORIAS.find(c => c.id === r.categoriaId); const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(r.criadoEm); return `<div class="record-row"><span class="record-avatar">${cat ? iconeBordado(cat, true) : escapar(r.crianca.replace("Criança ", "#"))}</span><div class="record-main"><strong>${escapar(r.crianca)}</strong><small>${escapar(cat?.nome || "Categoria")} · ${escapar(r.missao)}</small></div><span class="record-time">${hora}</span><button class="edit-record-button" type="button" data-edit-record="${escapar(r.id)}" aria-label="Editar registro de ${escapar(r.crianca)}">Editar</button></div>`; }).join("");
}
function iniciarEdicaoRegistro(id) {
  const registro = registros.find(item => item.id === id);
  if (!registro) return;
  registroEditandoId = registro.id;
  criancaSelecionada = registro.criancaId;
  categoriaSelecionada = registro.categoriaId;
  const crianca = CRIANCAS.find(item => item.id === criancaSelecionada);
  document.querySelector("#child-search").value = crianca ? nomeCrianca(crianca) : "";
  renderizarCriancas(document.querySelector("#child-search").value);
  renderizarCategorias();
  renderizarMissoes();
  const missaoAtual = (CATALOGO[categoriaSelecionada] || []).find(item => item.id === registro.missaoId || (!registro.missaoId && item.nome === registro.missao));
  document.querySelector("#mission-select").value = missaoAtual?.id || "";
  document.querySelector("#register-title").textContent = "Editar registro";
  document.querySelector("#form-feedback").textContent = "Altere os dados necessários e salve as correções.";
  document.querySelector("#edit-actions").hidden = false;
  atualizarBotao(); renderizarDescricaoMissao();
  document.querySelector("#register-title").scrollIntoView({ behavior: "smooth", block: "center" });
}
function cancelarEdicaoRegistro(mensagem = "Edição cancelada.") {
  registroEditandoId = ""; criancaSelecionada = ""; categoriaSelecionada = "";
  document.querySelector("#edit-actions").hidden = true;
  document.querySelector("#child-search").value = ""; document.querySelector("#mission-select").value = "";
  document.querySelector("#register-title").textContent = "Validar missão";
  document.querySelector("#form-feedback").textContent = mensagem;
  renderizarCriancas(); renderizarCategorias(); renderizarMissoes(); renderizarDescricaoMissao(); atualizarBotao();
}
function excluirRegistroEditando() {
  const registro = registros.find(item => item.id === registroEditandoId);
  if (!registro) { cancelarEdicaoRegistro("O registro não foi encontrado."); return; }
  if (!window.confirm(`Deseja excluir o registro de ${registro.crianca} · ${registro.missao}?`)) return;
  const anteriores = registros;
  registros = registros.filter(item => item.id !== registroEditandoId);
  try { salvarRegistros(); }
  catch { registros = anteriores; document.querySelector("#form-feedback").textContent = "Não foi possível excluir o registro neste aparelho."; return; }
  renderizarResumo(); renderizarRegistros(); renderizarProgresso(document.querySelector("#progress-search").value); renderizarHome(); renderizarPodio();
  cancelarEdicaoRegistro("Registro excluído. A missão voltou para a lista disponível.");
}
function atualizarEstadoRede() { const online = navigator.onLine; document.querySelector("#sync-status").innerHTML = `<i style="background:${online ? "#74ad79" : "#d49a46"}"></i><span>${online ? "Salvo neste aparelho" : "Offline · salvo neste aparelho"}</span>`; }
function aplicarTema(tema) {
  const escuro = tema === "escuro";
  document.documentElement.dataset.theme = escuro ? "escuro" : "claro";
  const botao = document.querySelector("#theme-toggle");
  botao.setAttribute("aria-pressed", String(escuro));
  botao.setAttribute("aria-label", escuro ? "Ativar modo claro" : "Ativar modo escuro");
  botao.querySelector(".theme-icon").textContent = escuro ? "☀" : "☾";
  botao.querySelector(".theme-label").textContent = escuro ? "Modo claro" : "Modo escuro";
}
function mostrarToast(mensagem) { const toast = document.querySelector("#toast"); toast.textContent = mensagem; toast.classList.add("visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800); }

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
aplicarTema(localStorage.getItem(CHAVE_TEMA) || "claro");
renderizarListaInstrutores();
renderizarCriancas(); renderizarCategorias(); renderizarCategoriasPublicas(); renderizarMissoes(); renderizarResumo(); renderizarRegistros(); atualizarEstadoRede();
renderizarDescricaoMissao();
alternarAbaAcesso(instrutores.length ? "login" : "cadastro");
document.querySelector("#theme-toggle").addEventListener("click", () => {
  const proximoTema = document.documentElement.dataset.theme === "escuro" ? "claro" : "escuro";
  localStorage.setItem(CHAVE_TEMA, proximoTema);
  aplicarTema(proximoTema);
});
document.querySelector("#child-search").addEventListener("input", e => renderizarCriancas(e.target.value));
document.querySelector("#progress-search").addEventListener("input", e => renderizarProgresso(e.target.value));
document.querySelector("#bonus-history-search").addEventListener("input", () => renderizarPodio());
document.querySelector("#child-list").addEventListener("click", e => { const botao = e.target.closest("[data-child]"); if (!botao) return; criancaSelecionada = botao.dataset.child; renderizarCriancas(document.querySelector("#child-search").value); renderizarMissoes(); renderizarDescricaoMissao(); });
document.querySelector("#mission-select").addEventListener("change", () => { atualizarBotao(); renderizarDescricaoMissao(); });
document.querySelector("#category-list").addEventListener("click", e => { const botao = e.target.closest("[data-category]"); if (!botao) return; categoriaSelecionada = botao.dataset.category; renderizarCategorias(); renderizarMissoes(); renderizarDescricaoMissao(); });
document.querySelectorAll(".section-tab").forEach(botao => botao.addEventListener("click", () => mostrarArea(botao.dataset.view)));
document.querySelector("#bonus-form").addEventListener("submit", registrarPontosExtras);
document.querySelector("#home-open-records").addEventListener("click", () => mostrarArea("view-dashboard"));
document.querySelector("#home-open-progress").addEventListener("click", () => mostrarArea("view-progress"));
document.querySelector("#add-memories-button").addEventListener("click", () => document.querySelector("#memories-input").click());
document.querySelector("#memories-input").addEventListener("change", evento => { if (evento.target.files?.length) salvarArquivosDeMomentos([...evento.target.files]); });
document.querySelector("#memories-gallery").addEventListener("click", evento => { const botao = evento.target.closest("[data-delete-memory]"); if (botao) removerMomento(botao.dataset.deleteMemory); });
document.querySelector("#save-children").addEventListener("click", salvarCadastroCriancas);
document.querySelector("#add-child").addEventListener("click", () => adicionarCrianca());
document.querySelector("#children-editor").addEventListener("click", e => { const botao = e.target.closest("[data-remove-child]"); if (botao) cancelarNovaCrianca(botao.dataset.removeChild); });
document.querySelector("#add-child-from-record").addEventListener("click", () => {
  if (CRIANCAS.length >= LIMITE_CRIANCAS) { document.querySelector("#form-feedback").textContent = "O grupo já atingiu o limite de 30 crianças."; return; }
  retornarAosRegistros = true; mostrarArea("view-children"); adicionarCrianca();
});
document.querySelector("#children-editor").addEventListener("input", e => { if (e.target.closest("[data-child-church]")) renderizarListaIgrejas(); });
document.querySelector("#missions-editor").addEventListener("click", e => { const botao = e.target.closest("[data-save-mission]"); if (botao) salvarMissao(botao.dataset.category, botao.dataset.saveMission); });
document.querySelector("#recent-list").addEventListener("click", e => { const botao = e.target.closest("[data-edit-record]"); if (botao) iniciarEdicaoRegistro(botao.dataset.editRecord); });
document.querySelector("#cancel-edit").addEventListener("click", cancelarEdicaoRegistro);
document.querySelector("#delete-edit-record").addEventListener("click", excluirRegistroEditando);
document.querySelectorAll(".auth-tab").forEach(botao => botao.addEventListener("click", () => alternarAbaAcesso(botao.dataset.auth)));
document.querySelector("#register-form").addEventListener("submit", cadastrarInstrutor);
document.querySelector("#login-form").addEventListener("submit", entrarInstrutor);
document.querySelector("#logout-button").addEventListener("click", () => {
  localStorage.removeItem(CHAVE_LOGIN_AUTOMATICO);
  document.querySelector("#remember-login").checked = false;
  usuarioAtual = null;
  document.querySelector("#inicio").hidden = true;
  document.querySelector(".topbar").hidden = true;
  document.querySelector("#public-home").hidden = false;
  document.querySelector("#login-screen").hidden = true;
  alternarAbaAcesso("login");
});
const abrirLogin = () => {
  document.querySelector("#public-home").hidden = true;
  document.querySelector("#login-screen").hidden = false;
  document.querySelector("#login-name").focus();
};
document.querySelector("#home-login-button").addEventListener("click", abrirLogin);
document.querySelector("#home-login-top").addEventListener("click", abrirLogin);
document.querySelector("#back-home-button").addEventListener("click", () => {
  document.querySelector("#login-screen").hidden = true;
  document.querySelector("#public-home").hidden = false;
});
document.querySelector("#record-form").addEventListener("submit", e => {
  e.preventDefault(); if (document.querySelector("#save-button").disabled) return;
  const crianca = CRIANCAS.find(c => c.id === criancaSelecionada);
  const categoria = CATEGORIAS.find(c => c.id === categoriaSelecionada);
  const missao = (CATALOGO[categoria.id] || []).find(item => item.id === document.querySelector("#mission-select").value);
  const duplicada = registros.some(r => r.id !== registroEditandoId && r.criancaId === crianca.id && r.categoriaId === categoria.id && (r.missaoId === missao?.id || (!r.missaoId && r.missao === missao?.nome)));
  if (duplicada) { document.querySelector("#form-feedback").textContent = "Essa missão já está registrada para esta criança."; renderizarMissoes(); return; }
  if (registroEditandoId) {
    const registro = registros.find(item => item.id === registroEditandoId);
    if (!registro) { cancelarEdicaoRegistro(); return; }
    registro.criancaId = crianca.id; registro.crianca = nomeCrianca(crianca); registro.categoriaId = categoria.id;
    registro.missaoId = missao?.id || ""; registro.missao = missao?.nome || "Missão";
    registro.alteradoEm = Date.now(); registro.alteradoPor = usuarioAtual?.id || ""; registro.sincronizado = false;
    try { salvarRegistros(); } catch { document.querySelector("#form-feedback").textContent = "Não foi possível salvar as alterações neste aparelho."; return; }
    renderizarResumo(); renderizarRegistros(); renderizarProgresso(document.querySelector("#progress-search").value); renderizarPodio(); mostrarToast("Alterações do registro salvas.");
    cancelarEdicaoRegistro("Registro atualizado com as alterações."); return;
  }
  registros.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, criancaId: crianca.id, crianca: nomeCrianca(crianca), categoriaId: categoria.id, missaoId: missao?.id || "", missao: missao?.nome || "Missão", instrutor: usuarioAtual?.id || "", instrutorNome: usuarioAtual?.nome || "", criadoEm: Date.now(), sincronizado: false });
  try { salvarRegistros(); } catch { document.querySelector("#form-feedback").textContent = "Não foi possível guardar neste aparelho."; return; }
  renderizarResumo(); renderizarRegistros(); renderizarProgresso(document.querySelector("#progress-search").value); renderizarPodio(); document.querySelector("#form-feedback").textContent = `${nomeCrianca(crianca)} · ${categoria.nome} · registro salvo.`; mostrarToast("Missão validada e salva no passaporte!");
  criancaSelecionada = ""; categoriaSelecionada = ""; document.querySelector("#child-search").value = ""; document.querySelector("#mission-select").value = ""; renderizarCriancas(); renderizarCategorias(); renderizarMissoes(); renderizarDescricaoMissao();
});
document.querySelector("#show-records").addEventListener("click", () => document.querySelector(".recent-panel").scrollIntoView({ behavior: "smooth", block: "center" }));
window.addEventListener("online", atualizarEstadoRede); window.addEventListener("offline", atualizarEstadoRede);
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
const contaLembrada = instrutores.find(conta => conta.id === localStorage.getItem(CHAVE_LOGIN_AUTOMATICO));
if (contaLembrada) abrirSessao(contaLembrada);
