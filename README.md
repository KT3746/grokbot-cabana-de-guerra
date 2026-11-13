# CABANA DE GUERRA

Jogo de navegador (PC e celular): de **dia** você cultiva, coleta e fortalece uma cabana; de **noite** ondas de zumbis atacam e você precisa defender.

**Jogue agora:** [https://kt3746.github.io/grokbot-cabana-de-guerra/](https://kt3746.github.io/grokbot-cabana-de-guerra/)

Versão atual: **1.11.0** - gráfico 3D baixo-poli (Three.js), com fallback 2D se o aparelho não tiver WebGL. (aparece no rodapé da tela).

## Como jogar

1. Abra o link acima (ou `index.html` em um servidor local).
2. Toque ou clique em **Começar**. O som só liga depois do primeiro toque (regra dos navegadores).
3. **De dia:** corte árvores (madeira), quebre pedras, mine veios prateados (ferro), plante sementes nas hortas e colha comida.
4. Abra **Criar** para fazer armas (estaca, arco de galho, lança de ferro), tochas, cercas, armadilhas e kits de reparo.
5. Escolha o item na barra de atalhos e use **Agir** para construir à sua frente, ou chegue perto da cabana com um kit para reparar.
6. Quando estiver pronto, toque em **Enfrentar a noite** (ou espere o relógio).
7. **De noite:** ataque os zumbis, use armadilhas e proteja a porta. Se a **cabana** ou a **sua vida** chegar a zero, o jogo acaba.
8. Sobreviva ao amanhecer para ganhar um novo dia - a dificuldade sobe a cada noite.
9. O recorde de noites fica salvo neste aparelho (`localStorage`).
10. Meta soft do dia (BRT): noites sobrevividas hoje e melhor run do dia, também em `localStorage`.

Coma para recuperar vida. Tochas iluminam a clareira. Cercas atrasam os zumbis.

### Novidades 1.11.0 (onda 8)

- **Celular em pé enxerga a clareira**: a câmera mostrava só ~5 m de largura (a cabana tapava a tela); agora mostra ~9,5 m e os zumbis aparecem antes de chegar.
- **Visão livre**: a cabana fica translúcida quando você ou um zumbi está atrás dela, e a copa da árvore some um pouco quando tapa você.
- **Avisos no lugar certo**: metas do dia e dica ficam logo abaixo do HUD (antes cobriam a barra de recursos) e os avisos do celular ficam acima dos botões.
- **Texto certo no celular**: a primeira dica fala de joystick e botões, não de WASD/E.

### Novidades 1.10.0 (onda 7)

- **Labuta em sequência**: de dia, cortar/minar/colher em cadeia mostra selo "xN labuta".
- **Criação celebrada**: ao criar um item, splash **CRIOU!** com o nome e faíscas.
- **Reparo sugerido**: com a cabana em perigo e kits na bolsa, o atalho Reparo pulsa.
- **Restam N!**: nos últimos 3 zumbis da noite, aviso no centro da tela.

### Novidades 1.9.0 (onda 6)

- **Golpe crítico**: 15% de chance (25% com sequência x3+) de CRÍTICO! dourado com dano x1,8, tremida e vibração.
- **Colheita farta**: brilho dourado e folhas ao colher, vibração e 20% de chance de SAFRA BOA (+1 comida).
- **Noite perfeita**: se a cabana não levar dano na noite, ganha +3 madeira e +2 pedra e um selo dourado no resumo do amanhecer.

### Novidades 1.8.0 (onda 5)

- **Sequência de nocautes**: à noite, nocautes em menos de 2,8s acumulam um selo "xN sequência" no centro (vibra e brilha a partir de x5).
- **Flash nos recursos**: madeira, pedra, comida, ferro e sementes piscam verde/vermelho e mostram +N / -N quando mudam.
- **Anúncio de onda**: cada onda de zumbis abre um splash grande "Onda N" com vibração e flash.
- **Mira assistida no toque**: no celular, o ataque puxa levemente a mira para o zumbi mais perto (Galaxy / touch).

### Novidades 1.7.0 (onda 4)

- **Relógio do ciclo**: barrinha no chip de Dia/Noite mostra quanto falta; 10s antes do anoitecer o chip fica laranja, vibra e avisa para voltar à cabana.
- **Radar de zumbis**: à noite, setas vermelhas na borda da tela apontam zumbis fora da visão (número = grupo, seta grande = bruto).
- **Resumo do amanhecer**: cartão com nocautes, zumbis queimados no sol, dano na cabana e na vida, e selo de novo recorde.
- **Criar mais claro**: selo verde no botão Criar com quantos itens dá pra fazer agora; cada receita mostra "Pode criar" ou "Falta: …".

## Controles

### Computador

| Tecla / mouse | Ação |
| --- | --- |
| WASD ou setas | Andar |
| Mouse | Mirar |
| Clique no mundo | Agir / construir |
| Espaço | Atacar |
| E | Agir (cortar, minar, plantar, colher) |
| Q ou F | Comer |
| C | Abrir criação |
| N | Enfrentar a noite |
| 1–5 | Atalhos (arma, tocha, cerca, armadilha, reparo) |
| Esc ou P | Pausar |

### Celular

- **Joystick** à esquerda: andar
- **Agir**: cortar, minar, plantar, colher, construir
- **Atacar**: golpe ou flecha na direção que você está olhando
- **Comer**, **Noite**, **Pausa**: botões extras
- Barra de itens no meio da tela

## Som

O áudio é gerado no próprio navegador (nada de músicas prontas). Use **Som on / Som off**. O jogo começa sem tocar nada até o primeiro clique ou toque.

## Rodar no seu computador

Qualquer servidor estático serve. Exemplos:

```bash
python3 -m http.server 8080
```

Depois abra `http://localhost:8080`.

Não precisa instalar dependências: é HTML + CSS + JavaScript puro, com Three.js no próprio repositório.

## Arquivos

- `index.html` - página do jogo (GitHub Pages aponta para a raiz de `main`)
- `css/game.css` - interface
- `js/` - lógica, som, controles, `render.js` (2D de reserva) e `render3d.js` (cena Three.js)
- `js/vendor/three.module.js` - Three.js r160 local (mesmo padrão de FRONTEIRA e ECO)
- Os arquivos usam `?v=YYYYMMDDHHMM` (ex.: `?v=202611122230`) para o navegador não ficar com versão antiga após uma atualização
- `js/vendor/three.module.js` - Three.js r160 local (mesmo padrão de FRONTEIRA e ECO)
- Se o WebGL falhar, o jogo continua no canvas 2D e mostra um aviso em português

## Créditos

Jogo original. Sem nomes, mapas ou artes de outros jogos.