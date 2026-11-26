# ObservaBR — direção de arte
O panorama usa composição editorial e a exploração usa linguagem documental. As duas propostas e a justificativa estão em docs/DESIGN_REFERENCES.md. As capturas comparativas ficam em .tools/phase02.

A marca reúne o olho e a assinatura ObservaBR, preservando o pequeno traço de registro. O favicon usa a versão estática do olho fornecida pelo projeto. Manrope orienta a interface, Newsreader os títulos editoriais e IBM Plex Mono as datas, identificadores e valores. As fontes WOFF2 Latin são hospedadas pelo build, com licenças preservadas em docs/licenses.

Use tokens de tokens.css, tabelas e divisores. Reserve superfícies ao mapa, aos controles e às evidências. O cabeçalho horizontal reúne navegação, busca e links institucionais do projeto. O produto identifica sua independência e a cobertura parcial.

Antes de alterar a interface, consulte docs/DESIGN_SYSTEM.md e o checkpoint. Verifique o comportamento em navegador, ambos os temas e viewports de 390 a 1920 px. Dados, fontes, acessibilidade e significado documental orientam as decisões. Mantenha as restrições registradas em AGENTS.md.

## Olho da marca
O componente nativo reutilizável `<observa-eye>` está em apps/web/src/observa-eye.js e observa-eye.css, importado uma vez por main.js. Pode ser inserido em outros pontos após esse import; seu tamanho acompanha a fonte do contexto (1,35 em). No cabeçalho é decorativo, com aria-hidden, e o link mantém o nome acessível “ObservaBR, início”.

A geometria original está em apps/web/src/assets/observabr-icon.svg. O HTML observabr-olho-interativo.html fornecido foi usado como referência de comportamento, sem incorporar a página de demonstração. No cabeçalho, o fundo quadrado é removido e o contorno permanece imóvel. Íris e pupila se deslocam juntas, dentro de uma elipse de raios 5 e 3,2 unidades no viewBox de 64 unidades. Essa margem mantém o desenho interno contido no olho. O contorno herda --ink e a pupila usa --brand; os temas existentes controlam as cores. O favicon em apps/web/public/mark.svg conserva o SVG estático fornecido, inclusive seu fundo.

O cursor é observado na janela inteira. requestAnimationFrame interpola a posição com amortecimento de 84 ms, ajustado ao tempo entre quadros. A leitura da posição do componente acontece no quadro, e o laço para quando atinge o destino. A saída da janela e a perda de foco retornam suavemente ao centro. Documento oculto, touch e prefers-reduced-motion centralizam imediatamente. Dispositivos com capacidade touch ou sem ponteiro fino mantêm a versão estática; a preferência de movimento é observada durante a sessão. A desconexão do elemento cancela quadros e remove todos os listeners; a reconexão restaura o comportamento. Não há bibliotecas adicionais, sombras, brilhos ou efeitos sobre o contorno.

Validação automatizada: apps/web/tests/eye.test.mjs usa Chrome real para limites, repouso, retorno, preferências, touch, reutilização, favicon e dez capturas do cabeçalho em ambos os temas, nas larguras 390, 768, 1024, 1440 e 1920 px. Capturas locais em .tools/brand-eye. Execute após npm run build com node --test apps/web/tests/eye.test.mjs e CHROME_BIN quando necessário.
