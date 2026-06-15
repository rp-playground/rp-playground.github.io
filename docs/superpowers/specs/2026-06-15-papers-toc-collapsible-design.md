# Reading list: indice + sezioni/articoli collassabili

**Data:** 2026-06-15
**Pagina:** `/papers/papers-to-read/` (`_papers/papers-to-read.md`)

## Obiettivo

Aggiungere alla reading list un **indice** in cima alla pagina e rendere
**collassabili** sia le sezioni (`## H2`, es. *Interpretability*) sia i singoli
articoli (`### H3`) con la loro descrizione, mantenendo il markdown sorgente
pulito.

## Decisioni

- **Indice:** elenca le sezioni con, annidati, i titoli dei singoli articoli;
  tutte voci con link ad ancora.
- **Stato di default:** sezioni aperte, articoli chiusi (si vedono i titoli,
  la descrizione si espande al click).
- **Implementazione:** JS che trasforma l'HTML reso (progressive enhancement);
  niente `<details>` scritti a mano nel markdown.

## Architettura

Progressive enhancement. Il markdown resta una sequenza di `## Sezione` /
`### Titolo` / paragrafi. Uno script trasforma il DOM reso in accordion e
costruisce l'indice. Senza JS la pagina resta interamente leggibile (nessuna
regressione): è solo HTML semantico.

### Gating per pagina

Il layout `_layouts/paper.html` è condiviso da tutti i paper. L'enhancement si
attiva solo con il flag front matter `collapsible: true`. Quando presente, il
layout include lo `<style>` extra e lo `<script>` esterno; gli altri paper
restano invariati.

### Script — `/assets/js/paper-toc.js`

1. Scorre i figli di `.paper` (dopo l'header) e raggruppa per `<h2>`: ogni
   sezione diventa `<details class="toc-section" open>` con `<summary>` = testo
   dell'h2, inglobando tutti i nodi fino al successivo `<h2>`.
2. Dentro ogni sezione, ogni `<h3>` diventa `<details class="paper-item">`
   (chiuso) con `<summary>` = testo dell'h3, inglobando i nodi fino al prossimo
   `<h3>`/`<h2>`.
3. Assegna id stabili (slug del titolo) a sezioni e articoli per le ancore.
4. Costruisce `<nav class="toc">` in cima al contenuto: lista delle sezioni con
   sotto, annidati, i titoli degli articoli; ogni voce è un link `#id`.
5. Click su una voce dell'indice: apre la sezione e l'eventuale articolo di
   destinazione, poi esegue lo scroll — i link funzionano anche se il target è
   collassato.

Eventuale testo introduttivo prima del primo `## ` resta fuori dagli accordion
(sempre visibile), insieme all'indice.

### Stile (tema dark esistente)

- `summary`: niente marker nativo, cursore pointer, caret (`▸` → `▾`) che ruota
  all'apertura.
- Sezioni: riuso dello stile h2. Articoli: titolo cliccabile, hover su accent.
- Indice: box compatto con `--card`/`--border`, dopo l'intro e prima della
  prima sezione.

## File toccati

- `_papers/papers-to-read.md` — aggiunta di `collapsible: true` al front matter.
- `_layouts/paper.html` — `<style>` + `<script>` condizionati a `page.collapsible`.
- `assets/js/paper-toc.js` — nuovo.

## Edge case

- La "Companion paper" del primo articolo è un paragrafo dentro la descrizione
  (non un `### `): resta dentro l'articolo che la contiene.
- Pagina senza `<h2>`: lo script non costruisce l'indice e non altera il DOM.
