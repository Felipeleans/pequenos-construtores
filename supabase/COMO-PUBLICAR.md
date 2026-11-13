# Ativação da sincronização

O aplicativo já está preparado para sincronizar crianças, missões, registros e pontos extras entre aparelhos. Para ativar o serviço de nuvem, o repositório GitHub precisa receber quatro segredos de implantação. Eles não devem ser enviados por mensagem nem colocados em arquivos do site.

## 1. Criar os segredos do GitHub

No repositório `Felipeleans/pequenos-construtores`, abra **Settings → Secrets and variables → Actions → New repository secret** e crie:

- `SUPABASE_ACCESS_TOKEN`: crie em [tokens da conta Supabase](https://supabase.com/dashboard/account/tokens). Dá ao GitHub permissão para publicar as funções neste projeto.
- `SUPABASE_DB_PASSWORD`: senha do banco definida na criação do projeto Supabase.
- `PIN_PEPPER`: gere um valor aleatório forte localmente; não reutilize senha de conta.
- `BOOTSTRAP_TOKEN`: gere outro valor aleatório forte e guarde-o para colar uma única vez no formulário de ativação do app.

No PowerShell do Windows, estes comandos geram valores aleatórios criptográficos. Execute cada linha separadamente e guarde cada resultado num gerenciador de senhas:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Use o primeiro para `PIN_PEPPER` e o segundo para `BOOTSTRAP_TOKEN`. Digite o segundo também no campo **Código inicial de configuração** do app quando for ativar a equipe. Esse código só libera o primeiro cadastro; depois de criada a equipe, a função recusa novas ativações.

## 2. Publicar

Depois que os quatro segredos estiverem cadastrados, abra **Actions → Publicar sincronização segura → Run workflow**. Esse fluxo cria as tabelas protegidas e instala as funções de login, sincronização e recuperação. O site é publicado separadamente quando as alterações chegam à branch `main`.

## 3. Ativar no aparelho principal

Entre como Conta 1, abra **Equipe de instrutores → Ativar sincronização entre aparelhos**, informe o e-mail da mesma conta Supabase/GitHub, cole o código inicial guardado, confirme o PIN principal e ative. Os dados locais de crianças, missões, registros e pontos extras serão importados. O código de equipe exibido deve ser compartilhado apenas com os instrutores autorizados.

Os instrutores adicionais precisam ser cadastrados novamente com novos PINs, pois o aparelho antigo guarda apenas resumos locais irreversíveis. Fotos e vídeos permanecem no aparelho onde foram adicionados. Sem SMTP próprio, o e-mail de recuperação depende do remetente padrão do Supabase, que tem limites no plano gratuito.
