# Direção de arte do ObservaBR

Em 25 de novembro de 2026, duas composições foram comparadas no Chrome a 1440 px, antes de alterar as folhas de estilo da aplicação. O ensaio usou o índice da API local, a malha IBGE já distribuída e os componentes de busca, navegação, tabela, métricas e evidência. Os arquivos HTML são estudos locais de composição. As tabelas e os totais presentes nas imagens são retratos da consulta daquele momento.

| Estudo | Composição examinada | Decisão |
|---|---|---|
| A · Editorial contemporânea | Abertura em serifa, busca à direita, contagens junto à malha e leitura longitudinal das votações | Usar no panorama para explicar o alcance do índice antes de abrir uma consulta |
| B · Investigativa | Campo e filtros no topo, tabela compacta e proveniência em coluna lateral | Usar no diretório e no perfil para comparar registros e conferir evidências sem perder a posição de leitura |

O panorama segue a composição A e a exploração segue a composição B. A mesma marca tipográfica, as regras horizontais, a escala de espaçamento e as cores de ação mantêm a continuidade entre as duas. A abertura editorial dá contexto à cobertura parcial. A tipografia de interface, os números tabulares e o painel documental acompanham o trabalho mais preciso de ler uma despesa ou reconstruir um voto. Os temas claro e escuro estão disponíveis em ambas as composições.

### Estudos locais

- [A · HTML](../.tools/phase02/prototypes/A-editorial.html) · [Captura no Chrome](../.tools/phase02/prototypes/A-editorial.png)
- [B · HTML](../.tools/phase02/prototypes/B-investigativa.html) · [Captura no Chrome](../.tools/phase02/prototypes/B-investigativa.png)

### Referências consultadas

| Fonte | Aplicação no projeto |
|---|---|
| PortWatch VI | Indicador ligado à observação, horário de atualização e navegação por seções. A arquitetura pública separa HTML, CSS, módulos JS e automação. A página pública não abriu na ferramenta nesta consulta. O repositório forneceu o material de referência. [Análise da implementação](architecture/REFERENCE.md) · [Repositório](https://github.com/4lwayz/portwatch-vi) |
| The Pudding e Our World in Data | Relação entre a pergunta editorial, o gráfico e a fonte. No panorama, texto e mapa dividem uma seção e a legenda explica a medida. [The Pudding](https://pudding.cool/) · [Our World in Data](https://ourworldindata.org/) |
| ProPublica | Títulos de leitura pública em contraste com texto de serviço e metadados. [ProPublica](https://www.propublica.org/) |
| Aleph e OpenSanctions | Consulta orientada a entidades e evidências vinculadas. A alternativa investigativa explora filtros, identificação do registro e preservação do contexto da pesquisa. [Aleph](https://aleph.occrp.org/) · [OpenSanctions](https://www.opensanctions.org/) |
| Linear | Consistência dos controles e separação entre navegação de produto e navegação da tarefa. [Linear](https://linear.app/) |

Reuters Graphics também foi consultado. A página não pôde ser aberta neste ambiente, de modo que observações visuais específicas não entraram na avaliação. [Reuters Graphics](https://www.reuters.com/graphics/)

O conjunto Phosphor disponibiliza ícones para a web. As ações necessárias nesta versão já cabem em um conjunto pequeno de SVGs locais, com traço consistente e nome acessível atribuído ao controle. A direção privilegia ícones de ação e identificação documental. [Phosphor Icons](https://github.com/phosphor-icons/web)

O repositório Taste Skill foi avaliado como referência opcional. A equipe aplicou os critérios fornecidos no briefing e inspecionou a aplicação no Chrome com Playwright. O ensaio não exigiu instalação nem execução de código desse repositório. [Taste Skill](https://github.com/Leonxlnx/taste-skill)

### Ativos e conferência visual

Os arquivos LICENSE dos três pacotes Fontsource instalados identificam a SIL Open Font License 1.1. Os titulares citados são os autores do projeto Manrope, os autores do projeto Newsreader e a IBM. O ObservaBR serve os WOFF2 localmente. A ausência de arquivo de licença na raiz consultada do PortWatch VI motivou o uso exclusivo como referência de organização. A marca do ObservaBR, as folhas de estilo e os estudos são próprios.

A inspeção no Chrome comparou os dois estudos, a auditoria anterior, o panorama escuro, o diretório claro e o perfil escuro. A revisão móvel encontrou uma ultrapassagem de cinco pixels na busca a 375 px. O cabeçalho passou a distribuir os links auxiliares em uma segunda linha. Na atividade recente, a data e o acesso à fonte agora ficam abaixo do título quando a largura é pequena. Com o ajuste, o teste de navegador de 375 px passou e a inspeção em 390 px mediu 390 px de largura total. [Abertura móvel](../.tools/phase02/prototypes/verificacao-mobile.png) · [Linha documental móvel](../.tools/phase02/prototypes/verificacao-tabela.png) · [Matriz de inspeção](VISUAL_AUDIT.md)
