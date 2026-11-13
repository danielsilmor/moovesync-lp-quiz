/* ==========================================================================
   MooveSync — LP do quiz para gestores
   JavaScript puro, sem bibliotecas. Cada interação fica num bloco próprio.
   ========================================================================== */


/* --------------------------------------------------------------------------
   Configuração
   -------------------------------------------------------------------------- */
// O campo pede "e-mail corporativo": recusa provedores pessoais (gmail, hotmail…).
// Troque para false para aceitar qualquer e-mail.
const EXIGIR_EMAIL_CORPORATIVO = true;

const PROVEDORES_PESSOAIS = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.br', 'outlook.com', 'outlook.com.br',
  'live.com', 'msn.com', 'yahoo.com', 'yahoo.com.br', 'ymail.com', 'icloud.com', 'me.com',
  'bol.com.br', 'uol.com.br', 'terra.com.br', 'ig.com.br', 'globo.com', 'globomail.com',
  'aol.com', 'protonmail.com', 'proton.me', 'gmx.com', 'zoho.com',
];

const semAnimacao = window.matchMedia('(prefers-reduced-motion: reduce)');


/* --------------------------------------------------------------------------
   1. Entrada suave dos blocos ao rolar a página
   Os cards de "Por que responder" entram um depois do outro.
   -------------------------------------------------------------------------- */
document.querySelectorAll('.motivos__lista .revelar').forEach((card, indice) => {
  card.style.setProperty('--atraso', `${indice * 0.1}s`);
});

const blocosRevelar = document.querySelectorAll('.revelar');

if ('IntersectionObserver' in window) {
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      entrada.target.classList.add('esta-visivel');
      observador.unobserve(entrada.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

  blocosRevelar.forEach((bloco) => observador.observe(bloco));
} else {
  blocosRevelar.forEach((bloco) => bloco.classList.add('esta-visivel'));
}


/* --------------------------------------------------------------------------
   2. Botões "Responder ao quiz": rolam até o formulário e, no computador,
      já deixam o cursor no primeiro campo
   -------------------------------------------------------------------------- */
const formulario = document.querySelector('.js-formulario');
const primeiroCampo = formulario ? formulario.querySelector('.campo') : null;
const temMouse = window.matchMedia('(pointer: fine)');

document.querySelectorAll('a[href="#formulario"]').forEach((link) => {
  link.addEventListener('click', () => {
    if (!primeiroCampo || !temMouse.matches) return;
    window.setTimeout(() => primeiroCampo.focus({ preventScroll: true }), semAnimacao.matches ? 0 : 700);
  });
});


/* --------------------------------------------------------------------------
   3. Validação e envio do formulário
   Mensagens em português embaixo de cada campo, aria-invalid no campo com
   erro e foco no primeiro erro. Depois do cadastro, leva a pessoa ao quiz.
   - data-endpoint: endereço que recebe os dados (RD Station, webhook…)
   - data-quiz-url: endereço do quiz
   -------------------------------------------------------------------------- */
const padraoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function emailPessoal(valor) {
  const dominio = valor.split('@').pop().toLowerCase();
  return PROVEDORES_PESSOAIS.includes(dominio);
}

function mensagemDeErro(campo) {
  if (campo.type === 'checkbox') {
    return campo.required && !campo.checked
      ? 'Marque a autorização para receber o resultado do quiz.'
      : '';
  }

  const valor = campo.value.trim();
  if (campo.required && !valor) {
    if (campo.type === 'email') return 'Informe seu e-mail corporativo.';
    if (campo.name === 'nome') return 'Informe seu nome completo.';
    if (campo.name === 'empresa') return 'Informe o nome da empresa.';
    if (campo.name === 'cargo') return 'Informe seu cargo.';
    return 'Preencha este campo.';
  }
  if (campo.type === 'email' && valor && !padraoEmail.test(valor)) {
    return 'Digite um e-mail válido, como nome@empresa.com.br.';
  }
  if (EXIGIR_EMAIL_CORPORATIVO && campo.hasAttribute('data-corporativo') && valor && emailPessoal(valor)) {
    return 'Use seu e-mail corporativo (o da empresa), não um e-mail pessoal.';
  }
  return '';
}

function mostrarErro(campo, mensagem) {
  const caixaErro = document.getElementById(campo.getAttribute('aria-describedby'));
  if (caixaErro) caixaErro.textContent = mensagem;
  if (mensagem) {
    campo.setAttribute('aria-invalid', 'true');
  } else {
    campo.removeAttribute('aria-invalid');
  }
}

// Mostra um alerta em cápsula e esconde o outro
function mostrarAlerta(form, tipo) {
  const sucesso = form.querySelector('.js-alerta-sucesso');
  const erro = form.querySelector('.js-alerta-erro');
  if (sucesso) sucesso.hidden = tipo !== 'sucesso';
  if (erro) erro.hidden = tipo !== 'erro';
}

// Parâmetros de campanha (utm_source, utm_medium…) seguem junto com o cadastro
function dadosDoFormulario(form) {
  const dados = new FormData(form);
  const parametros = new URLSearchParams(window.location.search);
  parametros.forEach((valor, chave) => {
    if (chave.startsWith('utm_')) dados.append(chave, valor);
  });
  dados.append('pagina', window.location.href.split('?')[0]);
  return dados;
}

// Depois do cadastro: avisa e leva ao quiz (se o endereço estiver configurado)
function concluirCadastro(form) {
  const urlQuiz = form.dataset.quizUrl;
  const texto = form.querySelector('.js-alerta-sucesso-texto');

  if (urlQuiz && texto) {
    texto.textContent = 'Abrindo o quiz… ';
    const link = document.createElement('a');
    link.href = urlQuiz;
    link.textContent = 'Clique aqui se ele não abrir.';
    texto.append(link);
  }

  mostrarAlerta(form, 'sucesso');
  form.reset();

  if (urlQuiz) {
    window.setTimeout(() => { window.location.href = urlQuiz; }, 1200);
  }
}

async function enviar(form) {
  const botao = form.querySelector('button[type="submit"]');
  const rotulo = botao.querySelector('span') || botao;
  const textoOriginal = rotulo.textContent;
  rotulo.textContent = botao.dataset.textoEnviando || 'Enviando…';
  botao.disabled = true;
  botao.setAttribute('aria-busy', 'true');
  mostrarAlerta(form, null);

  try {
    const endpoint = form.dataset.endpoint;

    if (endpoint) {
      const resposta = await fetch(endpoint, {
        method: 'POST',
        body: dadosDoFormulario(form),
        headers: { Accept: 'application/json' },
      });
      if (!resposta.ok) throw new Error('falha no envio');
    } else {
      // Sem endpoint configurado ainda: só simula o envio (pré-visualização)
      console.info('[LP MooveSync] data-endpoint vazio: os dados não foram enviados a nenhum serviço.');
    }

    concluirCadastro(form);
  } catch (erro) {
    mostrarAlerta(form, 'erro'); // os dados digitados continuam no formulário
  } finally {
    rotulo.textContent = textoOriginal;
    botao.disabled = false;
    botao.removeAttribute('aria-busy');
  }
}

if (formulario) {
  const campos = formulario.querySelectorAll('[aria-describedby]');
  const isca = formulario.querySelector('input[name="site"]');

  // Depois do primeiro erro, a mensagem some assim que o campo fica correto
  campos.forEach((campo) => {
    const evento = campo.type === 'checkbox' ? 'change' : 'input';
    campo.addEventListener(evento, () => {
      if (campo.hasAttribute('aria-invalid')) mostrarErro(campo, mensagemDeErro(campo));
    });
  });

  // Botão X dos alertas
  formulario.querySelectorAll('.alerta__fechar').forEach((fechar) => {
    fechar.addEventListener('click', () => {
      fechar.closest('.alerta').hidden = true;
    });
  });

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();

    let primeiroInvalido = null;
    campos.forEach((campo) => {
      const mensagem = mensagemDeErro(campo);
      mostrarErro(campo, mensagem);
      if (mensagem && !primeiroInvalido) primeiroInvalido = campo;
    });

    if (primeiroInvalido) {
      primeiroInvalido.focus();
      return;
    }

    // Campo isca preenchido = robô: finge que deu certo e não envia nada
    if (isca && isca.value) {
      mostrarAlerta(formulario, 'sucesso');
      formulario.reset();
      return;
    }

    enviar(formulario);
  });
}
