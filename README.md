# Trajeto Casa-Trabalho

App pessoal (PWA) que registra o tempo real de trânsito, dia após dia, entre uma lista de
endereços candidatos (ponto A) e um endereço de trabalho fixo (ponto B), usando a API da
TomTom (grátis, sem cartão de crédito).

Tudo roda no navegador do celular — sem servidor, sem banco de dados pago. O histórico fica
salvo no `localStorage` do navegador (por isso o botão de exportar CSV/JSON existe: use-o
de vez em quando para não perder os dados se limpar o navegador ou trocar de celular).

## 1. Criar a chave grátis da TomTom

1. Acesse https://developer.tomtom.com/ e crie uma conta (só e-mail, sem cartão).
2. Crie uma "API Key" no painel.
3. Copie a chave.

## 2. Publicar no GitHub Pages

```bash
cd commute-tracker
git init
git add .
git commit -m "Initial commute tracker app"
```

Depois, crie um repositório vazio no GitHub (pelo site, ex: `commute-tracker`) e rode:

```bash
git remote add origin https://github.com/SEU_USUARIO/commute-tracker.git
git branch -M main
git push -u origin main
```

No GitHub: Settings → Pages → Source → Deploy from branch → `main` → `/ (root)` → Save.
Em ~1 minuto o app estará em `https://SEU_USUARIO.github.io/commute-tracker/`.

## 3. Instalar no celular

Abra o link no Chrome (Android) ou Safari (iPhone) e use "Adicionar à tela de início" —
vira um ícone de app normal.

## 4. Configurar dentro do app

Na aba **Config**:
1. Cole a chave da TomTom e salve.
2. Digite o endereço do trabalho e salve.
3. Adicione cada endereço candidato (apelido + endereço completo).

Na aba **Início**, toque em "Saí de casa agora" ao sair de casa, ou "Saí do trabalho agora"
ao sair do trabalho — o app consulta o tempo real de trânsito daquele instante, para todos
os endereços candidatos ao mesmo tempo, e salva.

Na aba **Histórico**, veja tabela, gráfico (colorido por dia da semana) e médias, filtrando
por endereço e sentido.

## Sobre os dados retornados pela TomTom

Cada consulta traz:
- `travelTimeSec`: tempo estimado agora, com trânsito ao vivo (o número principal mostrado).
- `trafficDelaySec`: quanto do tempo é atraso por trânsito (vs. via livre).
- `historicTimeSec` / `noTrafficTimeSec`: referências históricas/sem trânsito, guardadas no
  histórico para análises futuras caso você queira.
