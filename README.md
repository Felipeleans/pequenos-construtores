# Pequenos Construtores

PWA em português do Brasil para acompanhar missões individuais de crianças, progresso por categoria, registros, pontos extras e momentos da jornada.

## Publicação

A pasta `site/` é publicada no GitHub Pages. Depois de cada envio para a branch `main`, a ação **Publicar o Pequenos Construtores** atualiza o site HTTPS.

## Sincronização entre aparelhos

A versão do app pode sincronizar crianças, missões, registros e pontos extras entre os aparelhos da equipe, mantendo o uso offline e sincronizando as mudanças quando a internet voltar. O login usa nome e PIN individual de quatro dígitos, protegido pelo servidor. A Conta 1 recebe o link de recuperação e pode redefinir PINs.

Para ativar a nuvem, cadastre os quatro segredos do GitHub Actions e siga [supabase/COMO-PUBLICAR.md](supabase/COMO-PUBLICAR.md). O arquivo `supabase-bundle.zip` contém as funções e a estrutura protegida do banco usadas por essa publicação. Chaves administrativas nunca ficam no site.

Fotos e vídeos de “Momentos da jornada” ficam neste aparelho e não sincronizam.
