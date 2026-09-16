# CABANA DE GUERRA

Jogo de navegador (PC e celular): de **dia** você cultiva, coleta e fortalece uma cabana; de **noite** ondas de zumbis atacam e você precisa defender.

**Jogue agora:** [https://kt3746.github.io/grokbot-cabana-de-guerra/](https://kt3746.github.io/grokbot-cabana-de-guerra/)

Versão atual: **1.2.1** (correções de feedback e coleta) (nevoa, sangue, feedback de coleta) (tile 48 + DPR até 3; alcance de coleta corrigido). (aparece no rodapé da tela).

## Como jogar

1. Abra o link acima (ou `index.html` em um servidor local).
2. Toque ou clique em **Começar**. O som só liga depois do primeiro toque (regra dos navegadores).
3. **De dia:** corte árvores (madeira), quebre pedras, mine veios prateados (ferro), plante sementes nas hortas e colha comida.
4. Abra **Criar** para fazer armas (estaca, arco de galho, lança de ferro), tochas, cercas, armadilhas e kits de reparo.
5. Escolha o item na barra de atalhos e use **Agir** para construir à sua frente, ou chegue perto da cabana com um kit para reparar.
6. Quando estiver pronto, toque em **Enfrentar a noite** (ou espere o relógio).
7. **De noite:** ataque os zumbis, use armadilhas e proteja a porta. Se a **cabana** ou a **sua vida** chegar a zero, o jogo acaba.
8. Sobreviva ao amanhecer para ganhar um novo dia — a dificuldade sobe a cada noite.
9. O recorde de noites fica salvo neste aparelho (`localStorage`).

Coma para recuperar vida. Tochas iluminam a clareira. Cercas atrasam os zumbis.

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

Não precisa instalar dependências: é HTML + CSS + JavaScript puro.

## Arquivos

- `index.html` — página do jogo (GitHub Pages aponta para a raiz de `main`)
- `css/game.css` — interface
- `js/` — lógica, desenho, som e controles
- Os arquivos usam `?v=1.2.1` para o navegador não ficar com versão antiga após uma atualização

## Créditos

Jogo original. Sem nomes, mapas ou artes de outros jogos.
