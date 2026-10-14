# Cardápio Adriano Lanches · v2 "Na Chapa"

Cardápio digital da Adriano Lanches (Umuarama/PR). Cada lanche é desenhado pelo código, camada por camada, a partir dos ingredientes cadastrados. O cliente monta, turbina e acompanha o pedido ao vivo. Os pedidos caem no [Painel Adriano](https://github.com/pertso402/Painel-Adriano).

HTML, CSS e JavaScript puros, sem build. O backend é o Supabase (projeto CARDAPIOS-CLIENTES).

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | Estrutura da página |
| `style.css` | Visual "Na Chapa": chapa de aço quente, papel de comanda |
| `stack.js` | Desenha o lanche em corte lateral a partir da descrição ("Pão, salsicha, bacon e catupiry.") |
| `pix.js` | Gera o PIX copia e cola (BR Code estático do Banco Central) e o QR Code |
| `app.js` | Cardápio, montagem, carrinho, sugestões, checkout, PIX e acompanhamento |
| `config.js` | URL e chave pública do Supabase, slug da loja, link do painel |
| `vercel.json` | Cache e URLs limpas na Vercel |

## Como o desenho funciona

`stack.js` reconhece 16 ingredientes: alface, tomate, hambúrguer, grão-de-bico, picanha, frango, salsicha, calabresa, presunto, mussarela, cheddar, catupiry, bacon, ovo, milho e batata palha. Cada um vira uma camada e é empilhado numa ordem fixa, entre o pão de baixo e o pão prensado de cima. "2 mussarela" vira duas camadas.

Produto novo cadastrado no painel ganha desenho sozinho, desde que a descrição liste os ingredientes separados por vírgula. Ingrediente desconhecido é ignorado no desenho.

## Interações

- **Hero:** a anatomia do lanche mais pedido. Ao rolar, as camadas se juntam, a prensa desce e solta vapor.
- **Montar:** tirar um ingrediente faz a camada sair do desenho. Turbinar faz as camadas novas caírem.
- **Prensar e pedir:** a prensa desce no lanche antes de ir para a comanda.
- **Foto real:** produtos com foto mostram a opção "por dentro / foto real".

## Mecanismos de ticket médio

- **Turbinar:** upgrade para o lanche de cima (campo `upgrade_para`).
- **Bebida pós-lanche:** depois do primeiro lanche, sugere uma bebida.
- **Pra galera:** com 2 ou mais lanches, sugere a Coca 2L e mostra a economia contra as latas.
- **Sugestões na comanda:** bebida que faltou, turbinar, 2L.
- **Frete grátis:** a barra aparece quando o painel define `frete_gratis_acima`.
- **Repetir o de sempre:** último pedido e dados do cliente ficam no aparelho.

Cada item guarda a `origem` (`cardapio`, `upsell`, `bump`, `upgrade`, `repetir`). É assim que o painel mede quanto as sugestões venderam.

## PIX

Com a chave PIX preenchida no painel, quem escolhe PIX recebe, depois de confirmar o pedido, um QR Code e o copia e cola com o valor exato. O botão "Já paguei" avisa a loja (função `informar_pix`), e a confirmação do dono aparece na tela do cliente. Sem chave cadastrada, o PIX é pago na entrega.

## Rodar localmente

```bash
npx serve .
```
