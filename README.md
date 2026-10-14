# Cardápio Adriano Lanches · v2 "Na Chapa"

Cardápio digital da Adriano Lanches (Umuarama/PR). Cada lanche é desenhado pelo código, camada por camada, a partir dos ingredientes cadastrados. O cliente monta, turbina e acompanha o pedido ao vivo. Os pedidos caem no [Painel Adriano](https://github.com/pertso402/Painel-Adriano).

HTML, CSS e JavaScript puros, sem build. O backend é o Supabase (projeto CARDAPIOS-CLIENTES).

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | Estrutura da página |
| `style.css` | Visual "Na Chapa": escuro quente, foto em primeiro plano, comanda de papel (Archivo + DM Mono) |
| `stack.js` | Desenha o lanche em corte lateral a partir da descrição ("Pão, salsicha, bacon e catupiry."). Usado nos produtos sem foto e no "por dentro" |
| `pix.js` | Gera o PIX copia e cola (BR Code estático do Banco Central) e o QR Code |
| `app.js` | Cardápio, montagem, carrinho, sugestões, checkout, PIX e acompanhamento |
| `config.js` | URL e chave pública do Supabase, slug da loja, link do painel |
| `vercel.json` | Cache e URLs limpas na Vercel |

## Como o desenho funciona

`stack.js` reconhece 16 ingredientes: alface, tomate, hambúrguer, grão-de-bico, picanha, frango, salsicha, calabresa, presunto, mussarela, cheddar, catupiry, bacon, ovo, milho e batata palha. Cada um vira uma camada e é empilhado numa ordem fixa, entre o pão de baixo e o pão prensado de cima. "2 mussarela" vira duas camadas.

Produto novo cadastrado no painel ganha desenho sozinho, desde que a descrição liste os ingredientes separados por vírgula. Ingrediente desconhecido é ignorado no desenho.

## Interações

- **Abertura em uma tela:** título entra linha por linha, a foto do lanche mais pedido abre com recorte e zoom lento, vapor sobe sobre o lanche e a foto tem parallax leve ao rolar. O cardápio já aparece logo abaixo.
- **Os mais pedidos:** carrossel de fotos reais.
- **Lista compacta:** foto (ou desenho, para quem não tem foto) à direita e botão + de um toque.
- **Abas com indicador deslizante** que acompanha a categoria na tela.
- **Tela do item:** a foto "cresce" do cartão até o topo da tela. Tirar ingrediente ou turbinar troca pro "por dentro" e anima a camada saindo ou caindo.
- **Adicionar:** a imagem voa até a comanda e o contador gira.

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
