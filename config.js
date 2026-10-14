// Configuração pública do cardápio Adriano Lanches.
// A publishable key é segura no front-end: o acesso real é controlado pelas policies RLS do Supabase.
const SUPABASE_CONFIG = {
  url: 'https://imvzfueqnpkcrxumiqwz.supabase.co',
  key: 'sb_publishable_TtmQ7PjaXbu-asGSC9AJbQ_OaRl31ku',
};

// Identificador da loja dentro do projeto CARDAPIOS-CLIENTES (multi-loja).
const LOJA_SLUG = 'adriano-lanches';

// Link da engrenagem no rodapé (painel do restaurante). Vazio = engrenagem escondida.
const PAINEL_URL = 'https://painel-adriano.vercel.app';
