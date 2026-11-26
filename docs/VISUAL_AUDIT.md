# Auditoria visual da Fase 01
A interface existente usa Inter, painéis arredondados e composição de dashboard. Essas escolhas deverão ser revistas na Fase 02 conforme DESIGN.md.
Inspeção real no Chrome reproduziu canvas do mapa com 610 x 320 px e falha de carregamento do worker MapLibre. Os testes anteriores verificavam navegação e ausência de pageerror, mas não detectavam erros assíncronos emitidos no console pelo mapa.
Screenshots locais de auditoria ficam em .tools/audit-desktop.png e .tools/audit-mobile.png, ignorados no versionamento. A correção funcional deve verificar o carregamento efetivo da malha além da presença do canvas.


Correção verificada. O worker do MapLibre passou a ser emitido pelo Vite e configurado com setWorkerUrl. Chrome mostrou a malha preenchida e zero erros de console após o build. O teste foi reforçado para verificar canvas e console. A identidade visual existente permanece para avaliação na Fase 02.

## Encerramento da Fase 02 em 26/11/2026
A direção híbrida foi selecionada após comparar os protótipos editorial e investigativo. A implementação substituiu a sidebar por masthead e navegação horizontal, refez a hierarquia da página inicial, separou cobertura pública de processamento técnico e reorganizou diretório, perfil, tabelas e evidências.

A matriz final tests/phase02.test.mjs passou em 87,98 s. Foram geradas 30 capturas de panorama, diretório e perfil em 390, 768, 1024, 1440 e 1920 px, nos dois temas. Zero overflow de página, zero erros de execução e zero falhas na amostra automatizada de contraste. Menor razão medida de 7,857:1 no tema escuro e 6,626:1 no claro.

A validação inclui polígonos cartográficos respondendo ao ponteiro com contagem conferida na API, navegação regional, partido e ordenação aplicados no servidor, exportação com filtro, foco contido no dialog, Escape, retorno ao acionador, skip link, atalho de busca e página de demonstração do sistema.

As capturas finais de abertura desktop escura e mobile clara foram inspecionadas. As revisões anteriores também examinaram diretório claro, perfil escuro e a reorganização móvel das linhas documentais. Os screenshots ficam em .tools/phase02/after, e as versões anteriores em .tools/phase02/before. Protótipos e sua seleção constam em DESIGN_REFERENCES.md.

A comparação visual foi manual, com screenshots e assinaturas SHA-256 geradas pelo teste. A checagem de regressão por assinaturas é opcional e exige o mesmo navegador e ambiente. Não foi executada comparação automática de pixels entre a identidade antiga e a nova.

Os testes iniciais evidenciaram bloqueio de rede para fotos, timeouts e nomes acessíveis ambíguos nos selects. Foram adicionados nomes explícitos, uma captura de diagnóstico e espaçamento entre navegações. A execução final usou o Chrome com acesso autorizado às fotos institucionais. Canvas, imagens e controles nativos ficam fora do cálculo automatizado de contraste e exigem inspeção própria. Auditoria com leitores de tela e aparelhos físicos continua recomendada antes da publicação.

Consulte PHASE02_VALIDATION.md para comandos, métricas e limitações de medição.
