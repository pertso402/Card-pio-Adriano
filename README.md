# Cardápio Adriano Lanches

Cardápio digital da Adriano Lanches (Umuarama/PR). O cliente monta o pedido, escolhe entrega ou retirada e acompanha o status ao vivo. Os pedidos caem no [Painel Adriano](https://github.com/pertso402/Painel-Adriano).

HTML, CSS e JavaScript puros, sem build. O backend é o Supabase (projeto CARDAPIOS-CLIENTES).

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | Estrutura da página |
| `style.css` | Visual "A Comanda": cartaz de lanchonete + comanda de papel |
| `app.js` | Cardápio, carrinho, sugestões, checkout e acompanhamento |
| `config.js` | URL e chave pública do Supabase, slug da loja, link do painel |
| `vercel.json` | Cache e URLs limpas na Vercel |

## Como os dados chegam

- Loja, categorias e produtos vêm do Supabase e atualizam em tempo real (Realtime).
- O pedido é criado pela função `criar_pedido`. O preço é sempre recalculado no banco, nunca confiado ao navegador.
- O cliente acompanha o pedido pela função `status_pedido`, usando o token do pedido.
- Cada item guarda a `origem` (`cardapio`, `upsell`, `bump`, `upgrade`, `repetir`). É assim que o painel mede quanto as sugestões venderam.

## Mecanismos de ticket médio

- **Turbinar:** upgrade para o lanche de cima (campo `upgrade_para` do produto).
- **Bebida pós-lanche:** depois do primeiro lanche, sugere uma bebida.
- **Pra galera:** com 2 ou mais lanches, sugere a Coca 2L e mostra a economia contra as latas.
- **Sugestões na comanda:** bebida que faltou, turbinar, 2L.
- **Frete grátis:** a barra aparece quando `config.frete_gratis_acima` está preenchido no painel.
- **Repetir o de sempre:** último pedido e dados do cliente ficam salvos no aparelho.

## Rodar localmente

É um site estático: qualquer servidor serve.

```bash
npx serve .
```

## Publicar

Projeto na Vercel sem framework e sem build command, com a raiz deste repositório como diretório.
