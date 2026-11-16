const CATEGORIAS = [
  { id: "guardiao", nome: "Guardião(ã) da Palavra", icone: "✧", cor: "#4d7656", imagem: "./assets/categoria-guardiao.png" },
  { id: "explorador", nome: "Explorador(a)", icone: "⌖", cor: "#51798b", imagem: "./assets/categoria-explorador.png" },
  { id: "construtor", nome: "Construtor(a)", icone: "⚒", cor: "#bd8841", imagem: "./assets/categoria-construtor.png" },
  { id: "servo", nome: "Servo(a) Fiel", icone: "♡", cor: "#81699a", imagem: "./assets/categoria-servo-fiel.png" }
];
const CHAVE = "pequenos-construtores-registros-v1";
const CHAVE_TEMA = "pequenos-construtores-tema-v1";
const CHAVE_DESCRICOES = "pequenos-construtores-descricoes-v1";
const CHAVE_CRIANCAS = "pequenos-construtores-criancas-v1";
const CHAVE_CATALOGO = "pequenos-construtores-catalogo-v1";
const CHAVE_INSTRUTORES = "pequenos-construtores-instrutores-v1";
const CHAVE_LOGIN_AUTOMATICO = "pequenos-construtores-login-automatico-v1";
const CHAVE_REINICIO_CONTAS = "pequenos-construtores-reinicio-contas-v1";
const CHAVE_PONTOS_EXTRAS = "pequenos-construtores-pontos-extras-v1";
const NUVEM = window.PequenosConstrutoresCloud;
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
let membrosRemotos = [];
let usuarioAtual = null;
let criancaSelecionada = "";
let categoriaSelecionada = "";
let registroEditandoId = "";
let criancaNovaId = "";
let retornarAosRegistros = false;
let toastTimer;
let urlsMomentos = [];
let mostrarCriancasArquivadas = false;
let instrutorEditandoId = "";
let edicoesPendentesCadastro = new Map();

function lerRegistros() { try { return JSON.parse(localStorage.getItem(CHAVE) || "[]"); } catch { return []; } }
function lerDescricoes() { try { return JSON.parse(localStorage.getItem(CHAVE_DESCRICOES) || "{}"); } catch { return {}; } }
function lerPontosExtras() { try { const lista = JSON.parse(localStorage.getItem(CHAVE_PONTOS_EXTRAS) || "[]"); return Array.isArray(lista) ? lista.filter(item => item && typeof item.criancaId === "string" && Number.isSafeInteger(item.pontos) && item.pontos > 0) : []; } catch { return []; } }
function lerInstrutores() { try { const lista = JSON.parse(localStorage.getItem(CHAVE_INSTRUTORES) || "[]"); return Array.isArray(lista) ? lista : []; } catch { return []; } }
function salvarPontosExtras() { localStorage.setItem(CHAVE_PONTOS_EXTRAS, JSON.stringify(pontosExtras)); agendarSincronizacao(); }
function salvarInstrutores() { localStorage.setItem(CHAVE_INSTRUTORES, JSON.stringify(instrutores)); }
function agendarSincronizacao() {
  if (NUVEM?.lerSessao()?.access_token) definirStatusSincronizacao("pending", "Salvo neste aparelho · aguardando envio", "A sincronização com a equipe será feita em instantes.");
  NUVEM?.scheduleSync();
}
function ehInstrutorPrincipal() { return usuarioAtual?.papel === "principal"; }
function nomeDaConta(conta) {
  const valor = typeof conta === "string" ? conta : conta?.name ?? conta?.nome ?? conta?.display_name ?? conta?.full_name ?? conta?.user_metadata?.name ?? conta?.member?.name ?? "";
  const nome = String(valor).trim();
  return /^(undefined|null)$/i.test(nome) ? "" : nome;
}
function normalizarMembrosRemotos(resultado) {
  const lista = Array.isArray(resultado) ? resultado : resultado?.members ?? resultado?.data?.members ?? resultado?.data ?? [];
  if (!Array.isArray(lista)) return [];
  return lista.map(conta => ({ ...conta, name: nomeDaConta(conta) })).filter(conta => conta.name);
}
function renderizarListaInstrutores() {
  const seletor = document.querySelector("#login-name");
  const selecionado = seletor.value;
  const contas = membrosRemotos.length ? membrosRemotos : instrutores;
  const nomes = [...new Set(contas.map(nomeDaConta).filter(Boolean))];
  seletor.innerHTML = `<option value="">Selecione seu nome</option>${nomes.map(nome => `<option value="${escapar(nome)}">${escapar(nome)}</option>`).join("")}`;
  seletor.disabled = nomes.length === 0;
  const nomeSelecionado = nomes.find(nome => nome.toLocaleLowerCase("pt-BR") === selecionado.trim().toLocaleLowerCase("pt-BR"));
  if (nomeSelecionado) seletor.value = nomeSelecionado;
}
function renderizarEquipe() {
  const lista = document.querySelector("#team-list");
  if (!lista) return;
  const contas = membrosRemotos.length ? membrosRemotos : instrutores;
  document.querySelector("#team-count").textContent = `${contas.length} ${contas.length === 1 ? "instrutor" : "instrutores"}`;
  lista.innerHTML = contas.length ? contas.map(conta => { const principal = conta.role === "principal" || conta.papel === "principal"; const nome = conta.name || conta.nome; return `<article class="team-account"><div class="team-account-main"><span class="team-account-icon" aria-hidden="true">${principal ? "✦" : "♙"}</span><span class="team-account-info"><strong>${escapar(nome)}</strong><small>${principal ? "Conta principal · gerencia missões e equipe" : "Instrutor · registros e acompanhamento"}</small></span></div><div class="team-account-actions"><span class="team-role">${principal ? "Principal" : "Instrutor"}</span>${principal ? "" : `<button class="secondary-button" type="button" data-edit-instructor="${escapar(conta.id)}">Editar</button><button class="remove-child-button" type="button" data-delete-instructor="${escapar(conta.id)}">Remover</button>`}</div></article>`; }).join("") : `<div class="empty-state"><p>Nenhum instrutor cadastrado.</p></div>`;
}
function abrirEdicaoInstrutor(id) {
  const conta = membrosRemotos.length ? membrosRemotos.find(item => item.id === id) : instrutores.find(item => item.id === id);
  if (!conta || conta.role === "principal" || conta.papel === "principal") return;
  instrutorEditandoId = id;
  document.querySelector("#edit-instructor-name").value = conta.name || conta.nome || "";
  document.querySelector("#edit-instructor-pin").value = "";
  document.querySelector("#edit-instructor-pin-confirm").value = "";
  document.querySelector("#edit-instructor-feedback").textContent = "";
  document.querySelector("#edit-instructor-dialog").showModal();
}
async function salvarEdicaoInstrutor(evento) {
  evento.preventDefault();
  const feedback = document.querySelector("#edit-instructor-feedback");
  const nome = document.querySelector("#edit-instructor-name").value.trim();
  const pin = document.querySelector("#edit-instructor-pin").value;
  const confirmacao = document.querySelector("#edit-instructor-pin-confirm").value;
  const contas = membrosRemotos.length ? membrosRemotos : instrutores;
  const atual = contas.find(item => item.id === instrutorEditandoId);
  if (!atual || atual.role === "principal" || atual.papel === "principal") { feedback.textContent = "Esta conta não pode ser alterada por aqui."; return; }
  if (nome.length < 2) { feedback.textContent = "Informe um nome com pelo menos 2 caracteres."; return; }
  if (contas.some(item => item.id !== instrutorEditandoId && (item.name || item.nome || "").toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) { feedback.textContent = "Já existe uma conta com esse nome."; return; }
  if (pin && !/^\\d{4}$/.test(pin)) { feedback.textContent = "O PIN deve ter exatamente 4 dígitos."; return; }
  if (pin && pin !== confirmacao) { feedback.textContent = "Os PINs não coincidem."; return; }
  try {
    if (membrosRemotos.length) {
      if (!navigator.onLine) { feedback.textContent = "Conecte-se à internet para alterar o acesso compartilhado."; return; }
      await NUVEM.gerenciarInstrutor(instrutorEditandoId, "editar", nome, pin || undefined);
      const local = instrutores.find(item => item.id === instrutorEditandoId);
      if (local) {
        local.nome = nome;
        if (pin) { const credencial = await derivarSenha(pin); local.sal = credencial.sal; local.resumo = credencial.resumo; }
        salvarInstrutores();
      }
      membrosRemotos = await NUVEM.carregarMembrosAutenticados();
    } else {
      const local = instrutores.find(item => item.id === instrutorEditandoId);
      if (!local) return;
      local.nome = nome;
      if (pin) { const credencial = await derivarSenha(pin); local.sal = credencial.sal; local.resumo = credencial.resumo; }
      salvarInstrutores();
    }
    renderizarListaInstrutores(); renderizarEquipe();
    document.querySelector("#edit-instructor-dialog").close();
    mostrarToast("Acesso do instrutor atualizado.");
  } catch (erro) { feedback.textContent = erro?.message || "Não foi possível atualizar esse acesso."; }
}
async function removerInstrutor(id) {
  const contas = membrosRemotos.length ? membrosRemotos : instrutores;
  const conta = contas.find(item => item.id === id);
  const nome = conta?.name || conta?.nome;
  if (!conta || conta.role === "principal" || conta.papel === "principal") return;
  if (!confirm(`Remover o acesso de ${nome}? Essa pessoa não poderá mais entrar. Os registros das crianças serão mantidos.`)) return;
  try {
    if (membrosRemotos.length) {
      if (!navigator.onLine) { mostrarToast("Conecte-se à internet para remover o acesso compartilhado."); return; }
      await NUVEM.gerenciarInstrutor(id, "remover");
      membrosRemotos = await NUVEM.carregarMembrosAutenticados();
    }
    instrutores = instrutores.filter(item => item.id !== id); salvarInstrutores();
    renderizarListaInstrutores(); renderizarEquipe();
    mostrarToast(`Acesso de ${nome} removido.`);
  } catch (erro) { mostrarToast(erro?.message || "Não foi possível remover esse acesso."); }
}
async function salvarCredencialLocal(id, nome, senha, papel) {
  const credencial = await derivarSenha(senha);
  const conta = { id, nome, papel, sal: credencial.sal, resumo: credencial.resumo };
  instrutores = [...instrutores.filter(item => item.id !== id && item.nome.toLocaleLowerCase("pt-BR") !== nome.toLocaleLowerCase("pt-BR")), conta];
  salvarInstrutores();
  renderizarListaInstrutores();
  return conta;
}
async function carregarEquipeRemota(codigo) {
  const status = document.querySelector("#login-status");
  const botao = document.querySelector("#load-team-members");
  const valor = String(codigo || "").trim().toUpperCase();
  if (!valor) { status.textContent = "Digite o código da equipe para carregar os nomes."; return; }
  if (!NUVEM?.configurado()) { status.textContent = "A sincronização da equipe ainda não está configurada neste aplicativo."; return; }
  if (!navigator.onLine) { status.textContent = "Conecte este aparelho à internet para carregar os nomes."; return; }
  botao.disabled = true;
  botao.textContent = "Carregando…";
  status.textContent = "Buscando os nomes da equipe…";
  try {
    const resultado = await NUVEM.listarMembros(valor);
    membrosRemotos = normalizarMembrosRemotos(resultado);
    renderizarListaInstrutores();
    status.textContent = membrosRemotos.length ? "Nomes carregados. Selecione o instrutor e digite o PIN." : "Nenhum instrutor foi encontrado para este código.";
  } catch (erro) {
    membrosRemotos = [];
    renderizarListaInstrutores();
    status.textContent = erro?.message || "Não foi possível localizar a equipe. Confira o código e tente novamente.";
  } finally { botao.disabled = false; botao.textContent = "Carregar nomes"; }
}
function aplicarDadosDaNuvem() {
  const edicoesPendentes = CRIANCAS.map(crianca => {
    const valores = {
      nome: (document.querySelector(`[data-child-name="${crianca.id}"]`)?.value ?? crianca.nome).trim(),
      idade: Number(document.querySelector(`[data-child-age="${crianca.id}"]`)?.value ?? crianca.idade),
      igreja: (document.querySelector(`[data-child-church="${crianca.id}"]`)?.value ?? crianca.igreja).trim(),
      categoriaRepresentativa: document.querySelector(`[data-child-category="${crianca.id}"]`)?.value ?? crianca.categoriaRepresentativa
    };
    const alterada = crianca.nova || edicoesPendentesCadastro.has(crianca.id) || Object.keys(valores).some(chave => valores[chave] !== crianca[chave]);
    return alterada ? { ...crianca, ...valores } : null;
  }).filter(Boolean);
  registros = lerRegistros(); pontosExtras = lerPontosExtras(); CRIANCAS = lerCriancas(); CATALOGO = lerCatalogo();
  edicoesPendentes.forEach(edicao => {
    const indice = CRIANCAS.findIndex(crianca => crianca.id === edicao.id);
    if (indice >= 0) CRIANCAS[indice] = edicao;
    else CRIANCAS.push(edicao);
  });
  renderizarListaInstrutores(); renderizarCriancas(document.querySelector("#child-search").value);
  renderizarCategorias(); renderizarMissoes(); renderizarDescricaoMissao(); renderizarResumo(); renderizarRegistros();
  renderizarProgresso(document.querySelector("#progress-search").value); renderizarPodio(); renderizarHome(); renderizarMomentos();
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
  document.querySelector("#team-tab").hidden = !ehInstrutorPrincipal();
  const sessaoNuvem = NUVEM?.lerSessao();
  const idNuvem = sessaoNuvem?.user?.app_metadata?.member_id || sessaoNuvem?.user?.user_metadata?.member_id;
  const conectado = !!sessaoNuvem?.access_token && idNuvem === instrutor.id;
  if (sessaoNuvem?.access_token && !conectado) NUVEM.limparSessao();
  document.querySelector("#team-cloud-setup").hidden = conectado || !ehInstrutorPrincipal();
  document.querySelector("#cloud-setup-token").value = "";
  if (NUVEM?.lerCodigoEquipe()) {
    document.querySelector("#cloud-team-code").textContent = NUVEM.lerCodigoEquipe();
    document.querySelector("#cloud-team-code-panel").hidden = false;
  }
  renderizarEquipe();
  if (!ehInstrutorPrincipal() && document.querySelector("#view-team").classList.contains("active")) mostrarArea("view-dashboard");
  renderizarDescricaoMissao(); renderizarEditorMissoes(); renderizarHome(); renderizarMomentos();
  if (conectado && navigator.onLine) {
    NUVEM.carregarMembrosAutenticados().then(lista => { membrosRemotos = lista || []; renderizarEquipe(); renderizarListaInstrutores(); }).catch(() => {});
    sincronizarEmSegundoPlano();
  }
}
async function criarContaInstrutor(nome, senha, papel) {
  const credencial = await derivarSenha(senha);
  const conta = { id: crypto.randomUUID?.() || `instrutor-${Date.now()}-${Math.random()}`, nome, papel, sal: credencial.sal, resumo: credencial.resumo };
  const contasAnteriores = instrutores;
  instrutores = [...instrutores, conta];
  try { salvarInstrutores(); }
  catch (erro) { instrutores = contasAnteriores; throw erro; }
  renderizarListaInstrutores();
  renderizarEquipe();
  return conta;
}
async function cadastrarInstrutor(evento) {
  evento.preventDefault();
  const status = document.querySelector("#register-status");
  const nome = document.querySelector("#register-name").value.trim();
  const senha = document.querySelector("#register-password").value;
  const confirmacao = document.querySelector("#register-confirm").value;
  if (instrutores.length > 0) { status.textContent = "Entre na Conta principal e use a aba Equipe para adicionar instrutores."; return; }
  if (nome.length < 2) { status.textContent = "Informe o nome do instrutor."; return; }
  if (instrutores.some(item => item.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) { status.textContent = "Esse nome já está cadastrado. Entre com a conta existente."; return; }
  if (!/^\d{4}$/.test(senha)) { status.textContent = "O PIN deve ter exatamente 4 dígitos numéricos."; return; }
  if (senha !== confirmacao) { status.textContent = "As senhas não coincidem."; return; }
  status.textContent = "Criando a conta...";
  try {
    const conta = await criarContaInstrutor(nome, senha, "principal");
    document.querySelector("#register-password").value = "";
    document.querySelector("#register-confirm").value = "";
    abrirSessao(conta);
  } catch (erro) {
    status.textContent = erro?.message || "Não foi possível cadastrar a conta neste aparelho.";
  }
}
async function adicionarInstrutorEquipe(evento) {
  evento.preventDefault();
  const status = document.querySelector("#team-feedback");
  if (!ehInstrutorPrincipal()) { status.textContent = "Somente a Conta principal pode adicionar instrutores."; return; }
  const nome = document.querySelector("#team-name").value.trim();
  const senha = document.querySelector("#team-pin").value;
  const confirmacao = document.querySelector("#team-pin-confirm").value;
  if (nome.length < 2) { status.textContent = "Informe o nome do instrutor."; return; }
  const listaDuplicidade = NUVEM?.lerSessao()?.access_token ? membrosRemotos.map(item => ({ nome: item.name })) : instrutores;
  if (listaDuplicidade.some(item => item.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) { status.textContent = "Esse nome já está cadastrado. Escolha outro nome."; return; }
  if (!/^\d{4}$/.test(senha)) { status.textContent = "O PIN deve ter exatamente 4 dígitos numéricos."; return; }
  if (senha !== confirmacao) { status.textContent = "Os PINs não coincidem."; return; }
  status.textContent = "Criando o acesso...";
  try {
    if (NUVEM?.lerSessao()?.access_token) {
      if (!navigator.onLine) { status.textContent = "Conecte este aparelho à internet para adicionar um instrutor à equipe compartilhada."; return; }
      const resultado = await NUVEM.adicionarInstrutor(nome, senha);
      await salvarCredencialLocal(resultado.member.id, nome, senha, "instrutor");
      membrosRemotos = await NUVEM.carregarMembrosAutenticados();
    } else await criarContaInstrutor(nome, senha, "instrutor");
    renderizarEquipe();
    document.querySelector("#team-form").reset();
    status.textContent = `${nome} foi adicionado à equipe e já pode entrar com o próprio PIN.`;
  } catch (erro) { status.textContent = erro?.message || "Não foi possível adicionar o instrutor neste aparelho."; }
}
async function ativarCompartilhamento(evento) {
  evento.preventDefault();
  const status = document.querySelector("#cloud-setup-feedback");
  if (!ehInstrutorPrincipal()) { status.textContent = "Somente a Conta 1 pode configurar a equipe."; return; }
  if (!NUVEM?.configurado()) { status.textContent = "A conexão do banco ainda está sendo preparada."; return; }
  if (!navigator.onLine) { status.textContent = "Conecte-se à internet para ativar a sincronização."; return; }
  const setupToken = document.querySelector("#cloud-setup-token").value.trim();
  const pin = document.querySelector("#cloud-setup-pin").value;
  const email = document.querySelector("#cloud-recovery-email").value.trim();
  const teamName = document.querySelector("#cloud-team-name").value.trim();
  if (!setupToken) { status.textContent = "Informe o código inicial de configuração."; return; }
  if (!/^\d{4}$/.test(pin)) { status.textContent = "Digite o PIN atual da Conta 1."; return; }
  try {
    const credencial = await derivarSenha(pin, usuarioAtual.sal);
    if (credencial.resumo !== usuarioAtual.resumo) { status.textContent = "O PIN não corresponde à Conta 1 deste aparelho."; return; }
  } catch (erro) { status.textContent = erro?.message || "Não foi possível confirmar o PIN."; return; }
  status.textContent = "Protegendo a equipe e importando os dados deste aparelho...";
  try {
      const resultado = await NUVEM.configurarEquipe({ setup_token: setupToken, name: usuarioAtual.nome, pin, recovery_email: email, team_name: teamName }, document.querySelector("#remember-login").checked);
    const idAnterior = usuarioAtual.id;
    const conta = await salvarCredencialLocal(resultado.member.id, resultado.member.name, pin, "principal");
    instrutores = instrutores.filter(item => item.id !== idAnterior && item.id !== conta.id);
    instrutores.push(conta); salvarInstrutores();
    usuarioAtual = conta;
    if (localStorage.getItem(CHAVE_LOGIN_AUTOMATICO) === idAnterior) localStorage.setItem(CHAVE_LOGIN_AUTOMATICO, conta.id);
    NUVEM.salvarCodigoEquipe(resultado.team_code);
    document.querySelector("#cloud-team-code").textContent = resultado.team_code;
    document.querySelector("#cloud-team-code-panel").hidden = false;
    document.querySelector("#cloud-setup-token").value = "";
    document.querySelector("#cloud-setup-pin").value = "";
    document.querySelector("#cloud-setup-form").hidden = true;
    document.querySelector("#cloud-status-message").textContent = "Equipe ativada. Os dados locais estão sendo enviados para o banco compartilhado.";
    document.querySelector("#team-cloud-setup").hidden = false;
    try {
      await NUVEM.sync();
      document.querySelector("#cloud-status-message").textContent = "Equipe conectada e dados importados. Instrutores adicionais precisam ser cadastrados novamente aqui, com um novo PIN; os PINs locais antigos não podem ser recuperados.";
      membrosRemotos = await NUVEM.carregarMembrosAutenticados();
      renderizarEquipe();
    } catch (erro) {
      document.querySelector("#cloud-status-message").textContent = `A equipe foi criada, mas os dados continuam pendentes neste aparelho: ${erro?.message || "tente sincronizar novamente com internet"}`;
    }
    document.querySelector("#current-account-label").textContent = `${conta.nome} · Instrutor principal`;
    atualizarEstadoRede();
  } catch (erro) {
    status.textContent = erro?.message || "Não foi possível ativar a equipe compartilhada.";
  }
}
async function pedirRedefinicaoPin() {
  const status = document.querySelector("#login-status");
  const code = document.querySelector("#login-team-code").value.trim();
  if (!code) { status.textContent = "Informe o código da equipe para enviar a recuperação ao e-mail da Conta 1."; return; }
  if (!NUVEM?.configurado()) { status.textContent = "A recuperação por e-mail ainda está sendo preparada."; return; }
  if (!navigator.onLine) { status.textContent = "Conecte-se à internet para solicitar a recuperação."; return; }
  status.textContent = "Solicitando recuperação...";
  try {
    const result = await NUVEM.solicitarRedefinicao(code);
    status.textContent = result.message || "Se a equipe estiver configurada, o link foi enviado ao e-mail da Conta 1.";
  } catch (erro) { status.textContent = erro?.message || "Não foi possível solicitar a recuperação agora."; }
}
async function abrirTelaRedefinirPin() {
  const parametros = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = parametros.get("access_token");
  if (!token || parametros.get("type") !== "recovery") return;
  const login = document.querySelector("#login-screen");
  document.querySelector("#public-home").hidden = true;
  document.querySelector("#inicio").hidden = true;
  document.querySelector(".topbar").hidden = true;
  login.hidden = false;
  document.querySelector("#login-form").hidden = true;
  document.querySelector("#register-form").hidden = true;
  document.querySelector("#reset-pin-form").hidden = false;
  document.querySelector(".auth-tabs").hidden = true;
  try {
    const membros = await NUVEM.carregarMembrosAutenticados(token);
    document.querySelector("#reset-member").innerHTML = `<option value="">Selecione um instrutor</option>${membros.map(item => `<option value="${escapar(item.id)}">${escapar(item.name)}${item.role === "principal" ? " · Conta principal" : ""}</option>`).join("")}`;
    document.querySelector("#reset-pin-form").dataset.token = token;
  } catch (erro) { document.querySelector("#reset-pin-status").textContent = erro?.message || "Este link expirou ou não pode ser usado."; }
}
async function redefinirPinPorEmail(evento) {
  evento.preventDefault();
  const form = document.querySelector("#reset-pin-form");
  const status = document.querySelector("#reset-pin-status");
  const pin = document.querySelector("#reset-pin").value;
  const confirmacao = document.querySelector("#reset-pin-confirm").value;
  const memberId = document.querySelector("#reset-member").value;
  if (!memberId) { status.textContent = "Selecione o instrutor."; return; }
  if (!/^\d{4}$/.test(pin)) { status.textContent = "O PIN precisa ter quatro números."; return; }
  if (pin !== confirmacao) { status.textContent = "Os PINs não coincidem."; return; }
  status.textContent = "Redefinindo o PIN...";
  try {
    const resultado = await NUVEM.redefinirPin(form.dataset.token, memberId, pin);
    status.textContent = resultado.message || "PIN redefinido. Volte à tela de entrada.";
    document.querySelector("#reset-pin").value = "";
    document.querySelector("#reset-pin-confirm").value = "";
  } catch (erro) { status.textContent = erro?.message || "Não foi possível redefinir o PIN."; }
}
async function entrarInstrutor(evento) {
  evento.preventDefault();
  const status = document.querySelector("#login-status");
  const nome = document.querySelector("#login-name").value.trim().toLocaleLowerCase("pt-BR");
  const senha = document.querySelector("#login-password").value;
  const codigoEquipe = document.querySelector("#login-team-code").value.trim().toUpperCase();
  if (!/^\d{4}$/.test(senha)) { status.textContent = "Digite seu PIN de 4 dígitos."; return; }
  if (codigoEquipe && NUVEM?.configurado() && navigator.onLine) {
    status.textContent = "Verificando o acesso da equipe...";
    try {
      const resultado = await NUVEM.login(codigoEquipe, nome, senha, document.querySelector("#remember-login").checked);
      const conta = await salvarCredencialLocal(resultado.member.id, resultado.member.name, senha, resultado.member.role);
      document.querySelector("#login-password").value = "";
      if (document.querySelector("#remember-login").checked) localStorage.setItem(CHAVE_LOGIN_AUTOMATICO, conta.id);
      else localStorage.removeItem(CHAVE_LOGIN_AUTOMATICO);
      membrosRemotos = await NUVEM.carregarMembrosAutenticados().catch(() => resultado.members || []);
      abrirSessao(conta);
      sincronizarEmSegundoPlano();
      return;
    } catch (erro) { status.textContent = erro?.message || "Não foi possível entrar na equipe."; return; }
  }
  const conta = instrutores.find(item => item.nome.toLocaleLowerCase("pt-BR") === nome);
  if (!conta) { status.textContent = "Conta não encontrada. Confira o nome ou peça à Conta principal para cadastrar o acesso."; return; }
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
  const cadastro = aba === "cadastro" && instrutores.length === 0;
  document.querySelector("#login-form").hidden = cadastro;
  document.querySelector("#register-form").hidden = !cadastro;
  document.querySelectorAll(".auth-tab").forEach(botao => botao.classList.toggle("active", botao.dataset.auth === (cadastro ? "cadastro" : "login")));
  document.querySelector("#register-role-hint").textContent = "A primeira conta cadastrada será a principal. Depois, ela poderá incluir outros instrutores na aba Equipe.";
  document.querySelector('.auth-tab[data-auth="cadastro"]').hidden = instrutores.length > 0;
}
function lerCriancas() {
  try {
    const salvas = JSON.parse(localStorage.getItem(CHAVE_CRIANCAS) || "null");
    if (!Array.isArray(salvas)) return [];
    return salvas.filter(salva => salva && typeof salva.id === "string" && !registroDeCriancaVazioLegado(salva)).map(salva => ({
      id: salva.id,
      nome: typeof salva.nome === "string" ? salva.nome : "",
      idade: Math.min(12, Math.max(6, Number(salva.idade) || 6)),
      igreja: typeof salva.igreja === "string" ? salva.igreja : "",
      categoriaRepresentativa: CATEGORIAS.some(categoria => categoria.id === salva.categoriaRepresentativa) ? salva.categoriaRepresentativa : "",
      arquivada: Boolean(salva.arquivada)
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
function salvarRegistros() { localStorage.setItem(CHAVE, JSON.stringify(registros)); agendarSincronizacao(); }
function salvarCatalogo() { localStorage.setItem(CHAVE_CATALOGO, JSON.stringify(CATALOGO)); agendarSincronizacao(); }
function escapar(texto) { return String(texto).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function iconeBordado(categoria, pequeno = false) {
  if (!categoria?.imagem) return "";
  return `<img class="badge-art${pequeno ? " badge-art-small" : ""}" src="${categoria.imagem}" alt="" loading="lazy" decoding="async">`;
}
function renderizarCriancas(filtro = "") {
  const lista = document.querySelector("#child-list");
  const termo = filtro.trim().toLocaleLowerCase("pt-BR");
  const cadastradas = CRIANCAS.filter(crianca => !crianca.nova && !crianca.arquivada)
    .sort((a, b) => Number(a.id.match(/(\d+)$/)?.[1] || 0) - Number(b.id.match(/(\d+)$/)?.[1] || 0));
  const totalCriancas = document.querySelector("#children-count");
  if (totalCriancas) totalCriancas.textContent = String(cadastradas.length);
  const atalhoAdicionar = document.querySelector("#add-child-from-record");
  if (atalhoAdicionar) atalhoAdicionar.disabled = false;
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
  document.querySelector("#category-list").innerHTML = CATEGORIAS.map(c => `<button type="button" class="category-option ${categoriaSelecionada === c.id ? "selected" : ""}" data-category="${c.id}" aria-pressed="${categoriaSelecionada === c.id}"><span class="category-medallion"><img class="category-image" src="${c.imagem}" alt="" width="112" height="112" decoding="async"></span><strong>${c.nome}</strong></button>`).join("");
}
function renderizarMissoes() {
  const select = document.querySelector("#mission-select");
  const botaoMissoes = document.querySelector("#mission-buttons");
  const missaoSelecionada = select.value;
  const missoes = categoriaSelecionada && criancaSelecionada ? (CATALOGO[categoriaSelecionada] || []).filter(m => !registros.some(r => r.id !== registroEditandoId && r.criancaId === criancaSelecionada && r.categoriaId === categoriaSelecionada && (r.missaoId === m.id || (!r.missaoId && r.missao === m.nome)))) : [];
  select.disabled = !categoriaSelecionada || !criancaSelecionada || !missoes.length;
  select.innerHTML = missoes.map(m => `<option value="${m.id}">${escapar(m.nome)}</option>`).join("");
  select.value = missoes.some(m => m.id === missaoSelecionada) ? missaoSelecionada : "";
  const categoria = CATEGORIAS.find(item => item.id === categoriaSelecionada);
  botaoMissoes.innerHTML = missoes.map((missao, indice) => `<button type="button" class="mission-patch ${select.value === missao.id ? "selected" : ""}" data-mission="${escaparAtributo(missao.id)}" aria-pressed="${select.value === missao.id}"><span class="mission-patch-emblem">${categoria ? iconeBordado(categoria, true) : ""}</span><span class="mission-patch-copy"><small>MISSÃO ${String(indice + 1).padStart(2, "0")}</small><strong>${escapar(missao.nome)}</strong></span><span class="mission-patch-check" aria-hidden="true">✓</span></button>`).join("");
  const estado = !criancaSelecionada ? "Selecione uma criança para ver as missões." : !categoriaSelecionada ? "Escolha uma categoria para ver as missões." : !missoes.length ? "Esta criança já concluiu todas as missões desta categoria." : "Toque em uma missão para ver a descrição.";
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
  const exibidas = CRIANCAS.filter(crianca => Boolean(crianca.arquivada) === mostrarCriancasArquivadas)
    .sort((a, b) => Number(a.id.match(/(\d+)$/)?.[1] || 0) - Number(b.id.match(/(\d+)$/)?.[1] || 0));
  const alternar = document.querySelector("#toggle-archived-children");
  alternar.textContent = mostrarCriancasArquivadas ? "Ver crianças ativas" : `Ver arquivadas (${CRIANCAS.filter(crianca => crianca.arquivada).length})`;
  alternar.setAttribute("aria-pressed", String(mostrarCriancasArquivadas));
  editor.innerHTML = exibidas.length ? exibidas.map(crianca => `<div class="child-edit-row ${crianca.nova ? "new-child-row" : ""} ${edicoesPendentesCadastro.has(crianca.id) ? "unsaved-child-row" : ""} ${crianca.arquivada ? "archived-child-row" : ""}"><span class="child-edit-number">#${String(crianca.id.match(/(\d+)$/)?.[1] || "").padStart(2, "0")}</span><label class="child-name-field"><span>Nome</span><input type="text" maxlength="70" data-child-name="${crianca.id}" value="${escapar(crianca.nome)}" placeholder="Nome da criança"></label><label class="child-age-field"><span>Idade</span><select data-child-age="${crianca.id}"><option value="" disabled ${crianca.idade ? "" : "selected"}>Selecione</option>${Array.from({ length: 7 }, (_, i) => `<option value="${i + 6}" ${crianca.idade === i + 6 ? "selected" : ""}>${i + 6} anos</option>`).join("")}</select></label><label class="child-church-field"><span>Igreja</span><input type="text" maxlength="100" data-child-church="${crianca.id}" value="${escapar(crianca.igreja)}" placeholder="Nome da igreja"></label><label class="child-category-field"><span>Categoria representativa</span><select data-child-category="${crianca.id}"><option value="">Sem categoria</option>${CATEGORIAS.map(categoria => `<option value="${categoria.id}" ${crianca.categoriaRepresentativa === categoria.id ? "selected" : ""}>${categoria.nome}</option>`).join("")}</select></label><div class="child-row-actions"><button type="button" class="primary-button child-row-save" data-save-child="${crianca.id}">${edicoesPendentesCadastro.has(crianca.id) ? "Salvar alterações" : "Salvar criança"}</button>${crianca.nova ? `<button type="button" class="remove-child-button" data-remove-child="${crianca.id}">Cancelar</button>` : `${crianca.arquivada ? `<button type="button" class="secondary-button child-roster-action" data-restore-child="${crianca.id}">Restaurar</button>` : `<button type="button" class="remove-child-button child-roster-action" data-archive-child="${crianca.id}">Arquivar</button>`}<button type="button" class="delete-child-button" data-delete-child="${crianca.id}" aria-label="Excluir definitivamente ${escapar(nomeCrianca(crianca))}">Excluir</button>`}</div></div>`).join("") : `<div class="empty-state"><span aria-hidden="true">♙</span><p>${mostrarCriancasArquivadas ? "Nenhuma criança arquivada." : "Nenhuma criança ativa cadastrada ainda. Use “Adicionar criança” para começar."}</p></div>`;
  document.querySelectorAll("[data-child-church]").forEach(campo => campo.setAttribute("list", "church-options"));
  renderizarListaIgrejas();
  document.querySelector("#add-child").disabled = false;
  filtrarCadastroCriancas();
  renderizarCriancas(document.querySelector("#child-search").value);
}
function filtrarCadastroCriancas() {
  const campo = document.querySelector("#children-roster-search");
  const editor = document.querySelector("#children-editor");
  if (!campo || !editor) return;
  const termo = campo.value.trim().toLocaleLowerCase("pt-BR");
  const linhas = [...editor.querySelectorAll(".child-edit-row")];
  linhas.forEach(linha => {
    const campos = ["[data-child-name]", "[data-child-age]", "[data-child-church]", "[data-child-category]", ".child-edit-number"];
    const texto = campos.map(seletor => linha.querySelector(seletor)?.value ?? linha.querySelector(seletor)?.textContent ?? "").join(" ").toLocaleLowerCase("pt-BR");
    linha.hidden = Boolean(termo) && !texto.includes(termo);
  });
  const resultadoVazio = document.querySelector("#children-search-empty");
  if (resultadoVazio) resultadoVazio.hidden = !termo || !linhas.length || linhas.some(linha => !linha.hidden);
}
function adicionarCrianca() {
  const usados = new Set(CRIANCAS.map(crianca => Number(crianca.id.match(/(\d+)$/)?.[1])).filter(Boolean));
  let numero = 1; while (usados.has(numero)) numero++;
  const id = `crianca-${String(numero).padStart(2, "0")}`;
  CRIANCAS.push({ id, nome: "", idade: 0, igreja: "", categoriaRepresentativa: "", nova: true });
  criancaNovaId = id;
  renderizarCadastroCriancas();
  document.querySelector(`[data-child-name="${id}"]`).focus();
}
function definirArquivoCrianca(id, arquivada) {
  const crianca = CRIANCAS.find(item => item.id === id && !item.nova);
  if (!crianca) return;
  if (arquivada && !confirm(`Arquivar ${nomeCrianca(crianca)}? Ela sairá das listas de registro. Missões, pontos e histórico serão preservados e poderão ser consultados.`)) return;
  const nome = document.querySelector(`[data-child-name="${id}"]`)?.value.trim();
  const idade = Number(document.querySelector(`[data-child-age="${id}"]`)?.value);
  const igreja = document.querySelector(`[data-child-church="${id}"]`)?.value.trim();
  const categoria = document.querySelector(`[data-child-category="${id}"]`)?.value;
  if (nome) Object.assign(crianca, { nome, igreja: igreja ?? crianca.igreja, categoriaRepresentativa: categoria ?? crianca.categoriaRepresentativa });
  if (idade >= 6 && idade <= 12) crianca.idade = idade;
  crianca.arquivada = arquivada;
  try {
    localStorage.setItem(CHAVE_CRIANCAS, JSON.stringify(CRIANCAS.map(({ nova, ...item }) => item)));
    agendarSincronizacao();
    mostrarCriancasArquivadas = arquivada;
    renderizarCadastroCriancas(); renderizarPodio(); renderizarProgresso(document.querySelector("#progress-search").value);
    document.querySelector("#children-feedback").textContent = arquivada ? `${nomeCrianca(crianca)} foi arquivada. O histórico foi mantido.` : `${nomeCrianca(crianca)} voltou à lista ativa.`;
  } catch { crianca.arquivada = !arquivada; document.querySelector("#children-feedback").textContent = "Não foi possível atualizar o cadastro neste aparelho."; }
}
function excluirCriancaDefinitivamente(id) {
  const crianca = CRIANCAS.find(item => item.id === id && !item.nova);
  if (!crianca) return;
  const totalRegistros = registros.filter(item => item.criancaId === id).length;
  const totalExtras = pontosExtras.filter(item => item.criancaId === id).length;
  const confirmacao = `Excluir definitivamente ${nomeCrianca(crianca)}? O cadastro, ${totalRegistros} registro(s) de missão e ${totalExtras} concessão(ões) de pontos extras serão apagados deste aparelho e dos aparelhos sincronizados. Esta ação não pode ser desfeita.`;
  if (!window.confirm(confirmacao)) return;
  const anteriores = { children: CRIANCAS, records: registros, bonus: pontosExtras };
  const persistir = (criancas, registrosNovos, extrasNovos) => {
    localStorage.setItem(CHAVE_CRIANCAS, JSON.stringify(criancas));
    localStorage.setItem(CHAVE, JSON.stringify(registrosNovos));
    localStorage.setItem(CHAVE_PONTOS_EXTRAS, JSON.stringify(extrasNovos));
  };
  const criancasNovas = CRIANCAS.filter(item => item.id !== id).map(({ nova, ...item }) => item);
  const registrosNovos = registros.filter(item => item.criancaId !== id);
  const extrasNovos = pontosExtras.filter(item => item.criancaId !== id);
  try {
    persistir(criancasNovas, registrosNovos, extrasNovos);
    CRIANCAS = criancasNovas; registros = registrosNovos; pontosExtras = extrasNovos;
    edicoesPendentesCadastro.delete(id);
    agendarSincronizacao();
    if (criancaSelecionada === id) cancelarEdicaoRegistro("Criança excluída.");
    renderizarCadastroCriancas(); renderizarCriancas(document.querySelector("#child-search").value);
    renderizarResumo(); renderizarRegistros(); renderizarProgresso(); renderizarPodio(); renderizarHome();
    document.querySelector("#children-feedback").textContent = `Cadastro de ${nomeCrianca(crianca)} e seus registros excluídos definitivamente.`;
  } catch {
    try { persistir(anteriores.children, anteriores.records, anteriores.bonus); } catch {}
    CRIANCAS = anteriores.children; registros = anteriores.records; pontosExtras = anteriores.bonus;
    document.querySelector("#children-feedback").textContent = "Não foi possível excluir o cadastro neste aparelho.";
  }
}
function cancelarNovaCrianca(id) {
  const crianca = CRIANCAS.find(item => item.id === id);
  if (!crianca?.nova) return;
  edicoesPendentesCadastro.delete(id);
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
function salvarCadastroCriancas(id) {
  const alvo = CRIANCAS.find(crianca => crianca.id === id);
  if (!alvo) return;
  const dadosAlvo = {
    nome: (document.querySelector(`[data-child-name="${id}"]`)?.value ?? alvo.nome).trim(),
    idade: Number(document.querySelector(`[data-child-age="${id}"]`)?.value ?? alvo.idade),
    igreja: (document.querySelector(`[data-child-church="${id}"]`)?.value ?? alvo.igreja).trim(),
    categoriaRepresentativa: document.querySelector(`[data-child-category="${id}"]`)?.value ?? alvo.categoriaRepresentativa
  };
  if (!dadosAlvo.nome) {
    document.querySelector("#children-feedback").textContent = "Informe o nome desta criança antes de salvar.";
    document.querySelector(`[data-child-name="${id}"]`).focus();
    return;
  }
  if (dadosAlvo.idade < 6 || dadosAlvo.idade > 12) {
    document.querySelector("#children-feedback").textContent = "Escolha uma idade entre 6 e 12 anos para esta criança.";
    document.querySelector(`[data-child-age="${id}"]`).focus();
    return;
  }
  const rowsAtualizadas = CRIANCAS.map(crianca => {
    const valoresDaLinha = {
      nome: (document.querySelector(`[data-child-name="${crianca.id}"]`)?.value ?? crianca.nome).trim(),
      idade: Number(document.querySelector(`[data-child-age="${crianca.id}"]`)?.value ?? crianca.idade),
      igreja: (document.querySelector(`[data-child-church="${crianca.id}"]`)?.value ?? crianca.igreja).trim(),
      categoriaRepresentativa: document.querySelector(`[data-child-category="${crianca.id}"]`)?.value ?? crianca.categoriaRepresentativa
    };
    const atualizada = { ...crianca, ...valoresDaLinha };
    if (crianca.id === id) delete atualizada.nova;
    return atualizada;
  });
  const atualizacaoAlvo = rowsAtualizadas.find(crianca => crianca.id === id);
  const persistidas = lerCriancas();
  const indiceAlvo = persistidas.findIndex(crianca => crianca.id === id);
  const { nova, ...criancaSalva } = atualizacaoAlvo;
  if (indiceAlvo >= 0) persistidas[indiceAlvo] = criancaSalva;
  else persistidas.push(criancaSalva);
  try {
    localStorage.setItem(CHAVE_CRIANCAS, JSON.stringify(persistidas));
    const confirmacao = JSON.parse(localStorage.getItem(CHAVE_CRIANCAS) || "null");
    if (!Array.isArray(confirmacao) || !confirmacao.some(crianca => crianca.id === id && crianca.nome === dadosAlvo.nome)) throw new Error("A gravação não foi confirmada.");
  } catch {
    document.querySelector("#children-feedback").textContent = "Não foi possível confirmar o salvamento desta criança. Os dados continuam preenchidos; tente novamente.";
    return;
  }
  const retornarAosRegistrosAgora = retornarAosRegistros && criancaNovaId === id;
  edicoesPendentesCadastro.delete(id);
  CRIANCAS = rowsAtualizadas;
  criancaNovaId = CRIANCAS.find(crianca => crianca.nova)?.id || "";
  agendarSincronizacao();
  renderizarCadastroCriancas(); renderizarCriancas(document.querySelector("#child-search").value);
  renderizarProgresso(document.querySelector("#progress-search").value);
  document.querySelector("#children-feedback").textContent = `${dadosAlvo.nome} foi salva neste aparelho.${NUVEM?.lerSessao()?.access_token ? " A sincronização com a equipe está pendente." : ""}`;
  if (retornarAosRegistrosAgora) {
    const novaCrianca = CRIANCAS.find(crianca => crianca.id === id);
    retornarAosRegistros = false;
    if (novaCrianca) {
      mostrarArea("view-dashboard"); criancaSelecionada = novaCrianca.id;
      document.querySelector("#child-search").value = nomeCrianca(novaCrianca);
      renderizarCriancas(nomeCrianca(novaCrianca)); renderizarMissoes(); renderizarDescricaoMissao();
    }
  }
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
  if (id === "view-team" && !ehInstrutorPrincipal()) { mostrarToast("A aba Equipe é exclusiva da Conta principal."); return; }
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
  const cadastradas = CRIANCAS.filter(crianca => !crianca.nova && !crianca.arquivada);
  document.querySelector("#home-children-count").textContent = String(cadastradas.length);
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
  const criancas = CRIANCAS.filter(crianca => !crianca.nova && !crianca.arquivada).map(crianca => ({
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
    return `<article class="child-progress-card"><div class="child-progress-card-heading"><div class="child-progress-person"><span class="progress-child-avatar ${nomeDestaque} ${progressoCompleto}">${escapar(crianca.id.slice(-2))}</span><div class="child-progress-person-info"><div class="child-progress-name-line ${nomeDestaque} ${progressoCompleto}"><h3>${escapar(nomeCrianca(crianca))}</h3>${crianca.arquivada ? `<span class="team-role">Arquivada</span>` : ""}${representativa ? `<span class="child-representative-mark" title="Categoria representativa: ${escapar(representativa.nome)}">${iconeBordado(representativa, true)}</span>` : ""}</div><p>${crianca.idade} anos · ${escapar(crianca.igreja || "Igreja não informada")}</p></div></div><strong class="child-progress-total ${nomeDestaque} ${progressoCompleto}">${Math.min(totalConcluidas, totalMissoes)}<small>/${totalMissoes}</small></strong></div><div class="child-progress-categories">${detalhes}</div></article>`;
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
  renderizarMissoes();
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
function atualizarEstadoRede() {
  const online = navigator.onLine;
  const sessao = NUVEM?.lerSessao();
  if (!online) definirStatusSincronizacao("offline", "Sem conexão", "As alterações continuam guardadas neste aparelho e serão enviadas quando a internet voltar.");
  else if (sessao?.access_token) definirStatusSincronizacao("ready", "Conectado à equipe", "Use “Sincronizar agora” para enviar e receber os dados imediatamente.");
  else definirStatusSincronizacao("local", "Somente neste aparelho", "Entre na equipe para compartilhar os dados com os outros aparelhos.");
}
function definirStatusSincronizacao(estado, rotulo, detalhe, feedback = "") {
  const badge = document.querySelector("#sync-state-badge");
  const title = document.querySelector("#sync-center-title");
  const description = document.querySelector("#sync-center-detail");
  const message = document.querySelector("#sync-center-feedback");
  const topStatus = document.querySelector("#sync-status");
  if (badge) { badge.dataset.state = estado; document.querySelector("#sync-state-label").textContent = rotulo; }
  if (title) title.textContent = estado === "syncing" ? "Sincronização em andamento" : estado === "synced" ? "Dados atualizados" : estado === "error" ? "Sincronização não concluída" : "Sincronização do grupo";
  if (description) description.textContent = detalhe;
  if (message) { message.textContent = feedback; message.hidden = !feedback; }
  if (topStatus) {
    topStatus.dataset.state = estado;
    topStatus.querySelector("span").textContent = rotulo;
    topStatus.querySelector("i").style.background = estado === "synced" ? "#74ad79" : estado === "syncing" ? "#d2ad58" : "#d49a46";
  }
  const botao = document.querySelector("#sync-now");
  if (botao) {
    const conectado = !!NUVEM?.configurado() && !!NUVEM?.lerSessao()?.access_token;
    const texto = document.querySelector("#sync-now-label");
    const icone = botao.querySelector("span[aria-hidden='true']");
    if (texto) texto.textContent = conectado ? "Sincronizar agora" : "Conectar à equipe";
    if (icone) icone.textContent = conectado ? "⟳" : "↗";
    botao.disabled = estado === "syncing";
    botao.setAttribute("aria-busy", String(estado === "syncing"));
  }
}
function sincronizarEmSegundoPlano() {
  if (!NUVEM?.configurado() || !NUVEM?.lerSessao()?.access_token || !navigator.onLine) return Promise.resolve({ synced: false, pending: true });
  definirStatusSincronizacao("syncing", "Sincronizando…", "Enviando e recebendo dados da equipe.");
  return NUVEM.sync().then(resultado => {
    if (resultado?.synced) definirStatusSincronizacao("synced", "Sincronizado com a equipe", "Este aparelho e os demais estão com crianças, missões, registros e pontos atualizados.");
    else definirStatusSincronizacao("pending", "Aguardando sincronização", "Os dados permanecem salvos neste aparelho até a próxima conexão.");
    return resultado;
  }).catch(erro => {
    definirStatusSincronizacao("error", "Aguardando sincronização", "Os dados continuam salvos neste aparelho. Tente novamente quando a conexão estiver estável.");
    throw erro;
  });
}
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
document.querySelector("#mission-buttons").addEventListener("click", evento => {
  const botao = evento.target.closest("[data-mission]");
  if (!botao) return;
  document.querySelector("#mission-select").value = botao.dataset.mission;
  document.querySelector("#mission-buttons").querySelectorAll("[data-mission]").forEach(item => {
    const selecionado = item === botao;
    item.classList.toggle("selected", selecionado);
    item.setAttribute("aria-pressed", String(selecionado));
  });
  document.querySelector("#mission-select").dispatchEvent(new Event("change", { bubbles: true }));
});
document.querySelector("#category-list").addEventListener("click", e => { const botao = e.target.closest("[data-category]"); if (!botao) return; categoriaSelecionada = botao.dataset.category; renderizarCategorias(); renderizarMissoes(); renderizarDescricaoMissao(); });
document.querySelectorAll(".section-tab").forEach(botao => botao.addEventListener("click", () => mostrarArea(botao.dataset.view)));
document.querySelector("#bonus-form").addEventListener("submit", registrarPontosExtras);
document.querySelector("#home-open-records").addEventListener("click", () => mostrarArea("view-dashboard"));
document.querySelector("#home-open-progress").addEventListener("click", () => mostrarArea("view-progress"));
document.querySelector("#add-memories-button").addEventListener("click", () => document.querySelector("#memories-input").click());
document.querySelector("#memories-input").addEventListener("change", evento => { if (evento.target.files?.length) salvarArquivosDeMomentos([...evento.target.files]); });
document.querySelector("#memories-gallery").addEventListener("click", evento => { const botao = evento.target.closest("[data-delete-memory]"); if (botao) removerMomento(botao.dataset.deleteMemory); });
document.querySelector("#add-child").addEventListener("click", () => adicionarCrianca());
document.querySelector("#children-editor").addEventListener("click", e => { const salvar = e.target.closest("[data-save-child]"); const cancelar = e.target.closest("[data-remove-child]"); if (salvar) salvarCadastroCriancas(salvar.dataset.saveChild); else if (cancelar) cancelarNovaCrianca(cancelar.dataset.removeChild); });
document.querySelector("#children-editor").addEventListener("click", e => { const arquivar = e.target.closest("[data-archive-child]"); const restaurar = e.target.closest("[data-restore-child]"); const excluir = e.target.closest("[data-delete-child]"); if (arquivar) definirArquivoCrianca(arquivar.dataset.archiveChild, true); else if (restaurar) definirArquivoCrianca(restaurar.dataset.restoreChild, false); else if (excluir) excluirCriancaDefinitivamente(excluir.dataset.deleteChild); });
document.querySelector("#toggle-archived-children").addEventListener("click", () => { mostrarCriancasArquivadas = !mostrarCriancasArquivadas; renderizarCadastroCriancas(); });
document.querySelector("#children-roster-search").addEventListener("input", filtrarCadastroCriancas);
document.querySelector("#children-editor").addEventListener("input", filtrarCadastroCriancas);
document.querySelector("#children-editor").addEventListener("change", filtrarCadastroCriancas);
document.querySelector("#add-child-from-record").addEventListener("click", () => {
  retornarAosRegistros = true; mostrarArea("view-children"); adicionarCrianca();
});
document.querySelector("#children-editor").addEventListener("input", e => { if (e.target.closest("[data-child-church]")) renderizarListaIgrejas(); });
function indicarAlteracaoNoCadastro(e) {
  const linha = e.target.closest(".child-edit-row");
  if (!linha) return;
  linha.classList.add("unsaved-child-row");
  const botaoSalvar = linha.querySelector("[data-save-child]");
  if (botaoSalvar && !linha.classList.contains("new-child-row")) botaoSalvar.textContent = "Salvar alterações";
  const id = botaoSalvar?.dataset.saveChild || linha.querySelector("[data-remove-child]")?.dataset.removeChild;
  if (id) edicoesPendentesCadastro.set(id, {
    nome: document.querySelector(`[data-child-name="${id}"]`)?.value.trim() || "",
    idade: Number(document.querySelector(`[data-child-age="${id}"]`)?.value),
    igreja: document.querySelector(`[data-child-church="${id}"]`)?.value.trim() || "",
    categoriaRepresentativa: document.querySelector(`[data-child-category="${id}"]`)?.value || ""
  });
}
document.querySelector("#children-editor").addEventListener("input", indicarAlteracaoNoCadastro);
document.querySelector("#children-editor").addEventListener("change", indicarAlteracaoNoCadastro);
document.querySelector("#missions-editor").addEventListener("click", e => { const botao = e.target.closest("[data-save-mission]"); if (botao) salvarMissao(botao.dataset.category, botao.dataset.saveMission); });
document.querySelector("#recent-list").addEventListener("click", e => { const botao = e.target.closest("[data-edit-record]"); if (botao) iniciarEdicaoRegistro(botao.dataset.editRecord); });
document.querySelector("#cancel-edit").addEventListener("click", cancelarEdicaoRegistro);
document.querySelector("#delete-edit-record").addEventListener("click", excluirRegistroEditando);
document.querySelectorAll(".auth-tab").forEach(botao => botao.addEventListener("click", () => alternarAbaAcesso(botao.dataset.auth)));
document.querySelector("#register-form").addEventListener("submit", cadastrarInstrutor);
document.querySelector("#team-form").addEventListener("submit", adicionarInstrutorEquipe);
document.querySelector("#team-list").addEventListener("click", evento => { const editar = evento.target.closest("[data-edit-instructor]"); const remover = evento.target.closest("[data-delete-instructor]"); if (editar) abrirEdicaoInstrutor(editar.dataset.editInstructor); else if (remover) removerInstrutor(remover.dataset.deleteInstructor); });
document.querySelector("#edit-instructor-form").addEventListener("submit", salvarEdicaoInstrutor);
document.querySelector("#cancel-edit-instructor").addEventListener("click", () => document.querySelector("#edit-instructor-dialog").close());
document.querySelector("#login-form").addEventListener("submit", entrarInstrutor);
document.querySelector("#cloud-setup-form").addEventListener("submit", ativarCompartilhamento);
document.querySelector("#forgot-pin-button").addEventListener("click", pedirRedefinicaoPin);
document.querySelector("#reset-pin-form").addEventListener("submit", redefinirPinPorEmail);
document.querySelector("#back-to-login-after-reset").addEventListener("click", () => {
  history.replaceState(null, "", location.pathname + location.search);
  document.querySelector("#reset-pin-form").hidden = true;
  document.querySelector("#login-form").hidden = false;
  document.querySelector(".auth-tabs").hidden = false;
  document.querySelector("#reset-pin-status").textContent = "";
});
document.querySelector("#load-team-members").addEventListener("click", () => carregarEquipeRemota(document.querySelector("#login-team-code").value));
document.querySelector("#login-team-code").addEventListener("input", () => { membrosRemotos = []; renderizarListaInstrutores(); document.querySelector("#login-status").textContent = ""; });
document.querySelector("#copy-team-code").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(NUVEM.lerCodigoEquipe()); document.querySelector("#cloud-status-message").textContent = "Código da equipe copiado."; }
  catch { document.querySelector("#cloud-status-message").textContent = "Selecione e copie o código da equipe manualmente."; }
});
window.addEventListener("pc-cloud-updated", aplicarDadosDaNuvem);
window.addEventListener("pc-cloud-synced", () => {
  definirStatusSincronizacao("synced", "Sincronizado com a equipe", "Este aparelho e os demais estão com crianças, missões, registros e pontos atualizados.");
});
window.addEventListener("pc-cloud-sync-error", () => {
  definirStatusSincronizacao("error", "Aguardando sincronização", "Os dados continuam salvos neste aparelho. Tente novamente quando a conexão estiver estável.");
});
document.querySelector("#sync-now").addEventListener("click", async () => {
  if (!navigator.onLine) {
    definirStatusSincronizacao("offline", "Sem conexão", "As alterações continuam guardadas neste aparelho e serão enviadas quando a internet voltar.", "Conecte-se à internet para sincronizar agora.");
    return;
  }
  if (!NUVEM?.configurado()) {
    definirStatusSincronizacao("error", "Conexão indisponível", "Não foi possível carregar a configuração da equipe. Atualize o aplicativo quando estiver conectado à internet.");
    return;
  }
  if (!NUVEM?.lerSessao()?.access_token) {
    abrirLogin(true);
    return;
  }
  definirStatusSincronizacao("syncing", "Sincronizando…", "Enviando e recebendo crianças, missões, registros e pontos.");
  try {
    const resultado = await NUVEM.sync();
    if (resultado?.synced) definirStatusSincronizacao("synced", "Sincronizado com a equipe", "Este aparelho e os demais estão com crianças, missões, registros e pontos atualizados.");
    else definirStatusSincronizacao("pending", "Aguardando sincronização", "Os dados permanecem salvos neste aparelho e serão enviados quando a conexão estiver disponível.");
  } catch {
    definirStatusSincronizacao("error", "Aguardando sincronização", "Os dados continuam salvos neste aparelho. Tente novamente quando a conexão estiver estável.", "Não foi possível concluir a sincronização agora.");
  }
});
document.querySelector("#logout-button").addEventListener("click", () => {
  localStorage.removeItem(CHAVE_LOGIN_AUTOMATICO);
  NUVEM?.limparSessao();
  document.querySelector("#remember-login").checked = false;
  usuarioAtual = null;
  document.querySelector("#inicio").hidden = true;
  document.querySelector(".topbar").hidden = true;
  document.querySelector("#public-home").hidden = false;
  document.querySelector("#login-screen").hidden = true;
  alternarAbaAcesso("login");
});
const abrirLogin = (orientarConexao = false) => {
  document.querySelector("#public-home").hidden = true;
  document.querySelector("#login-screen").hidden = false;
  if (usuarioAtual) {
    document.querySelector(".topbar").hidden = true;
    document.querySelector("#inicio").hidden = true;
  }
  document.querySelector("#reset-pin-form").hidden = true;
  document.querySelector("#login-form").hidden = false;
  document.querySelector(".auth-tabs").hidden = false;
  document.querySelector("#login-team-code").value = NUVEM?.lerCodigoEquipe() || "";
  document.querySelector("#login-status").textContent = orientarConexao
    ? "Este aparelho ainda está no modo local. Informe o código da equipe, carregue os nomes e entre com seu nome e PIN para conectar."
    : "";
  if (document.querySelector("#login-team-code").value) {
    carregarEquipeRemota(document.querySelector("#login-team-code").value);
    document.querySelector("#login-name").focus();
  } else document.querySelector("#login-team-code").focus();
};
document.querySelector("#home-login-button").addEventListener("click", abrirLogin);
document.querySelector("#home-login-top").addEventListener("click", abrirLogin);
document.querySelector("#back-home-button").addEventListener("click", () => {
  document.querySelector("#login-screen").hidden = true;
  if (usuarioAtual) {
    document.querySelector("#public-home").hidden = true;
    document.querySelector(".topbar").hidden = false;
    document.querySelector("#inicio").hidden = false;
  } else document.querySelector("#public-home").hidden = false;
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
window.addEventListener("online", () => { atualizarEstadoRede(); sincronizarEmSegundoPlano().catch(() => {}); }); window.addEventListener("offline", atualizarEstadoRede);
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
const contaLembrada = instrutores.find(conta => conta.id === localStorage.getItem(CHAVE_LOGIN_AUTOMATICO));
const hashArgs = new URLSearchParams(location.hash.replace(/^#/, ""));
if (hashArgs.get("type") === "recovery") abrirTelaRedefinirPin();
else if (contaLembrada) abrirSessao(contaLembrada);
else if (NUVEM?.lerCodigoEquipe() && navigator.onLine) {
  document.querySelector("#login-team-code").value = NUVEM.lerCodigoEquipe();
  carregarEquipeRemota(NUVEM.lerCodigoEquipe());
}
setInterval(() => {
  if (usuarioAtual && navigator.onLine && NUVEM?.lerSessao()?.access_token) sincronizarEmSegundoPlano().catch(() => {});
}, 30000);
