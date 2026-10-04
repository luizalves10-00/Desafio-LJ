(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  let currentPlan = (params.get('plan') || 'monthly').toLowerCase().trim();

  // Elementos do DOM
  const planSelect = document.getElementById('plan-select');
  const summaryTitle = document.getElementById('summary-title');
  const summaryDesc = document.getElementById('summary-desc');
  const summaryPlanTag = document.getElementById('summary-plan-tag');
  const recurringLabel = document.getElementById('breakdown-recurring-label');
  const recurringVal = document.getElementById('breakdown-recurring-val');
  const disclaimerPrice = document.getElementById('disclaimer-price');

  const userName = document.getElementById('user-name');
  const userEmail = document.getElementById('user-email');
  const userAvatar = document.getElementById('user-avatar');

  const paymentAlert = document.getElementById('payment-alert');
  const paymentForm = document.getElementById('payment-form');
  const btnSubmit = document.getElementById('btn-submit');
  const btnText = document.getElementById('btn-text');
  const btnSpinner = document.getElementById('btn-spinner');

  // 1. Atualizar textos e dados do plano na tela
  function updatePlanUI(selectedPlan) {
    currentPlan = selectedPlan.toLowerCase().trim();
    const isYearly = currentPlan === 'yearly' || currentPlan === 'anual';

    if (planSelect && planSelect.value !== (isYearly ? 'yearly' : 'monthly')) {
      planSelect.value = isYearly ? 'yearly' : 'monthly';
      if (planSelect._emojiSync) planSelect._emojiSync();
    }

    if (isYearly) {
      if (summaryTitle) summaryTitle.textContent = 'Concurseiro Pro Anual';
      if (summaryDesc) summaryDesc.textContent = 'O plano definitivo até a posse com 17% de desconto e ferramentas completas por 1 ano.';
      if (summaryPlanTag) summaryPlanTag.textContent = 'Anual · 17% OFF';
      if (recurringLabel) recurringLabel.textContent = 'Após os 7 dias (Anual)';
      if (recurringVal) recurringVal.textContent = 'R$ 199,00 / ano (~R$ 16,58/mês)';
      if (disclaimerPrice) disclaimerPrice.textContent = 'R$ 199,00 / ano';
    } else {
      if (summaryTitle) summaryTitle.textContent = 'Concurseiro Pro Mensal';
      if (summaryDesc) summaryDesc.textContent = 'Acesso completo e irrestrito ao Mentor IA, simulados cronometrados por banca e banco de questões.';
      if (summaryPlanTag) summaryPlanTag.textContent = 'Mensal Flexível';
      if (recurringLabel) recurringLabel.textContent = 'Após os 7 dias (Mensal)';
      if (recurringVal) recurringVal.textContent = 'R$ 19,90 / mês';
      if (disclaimerPrice) disclaimerPrice.textContent = 'R$ 19,90 / mês';
    }
  }

  // Inicializar UI do plano
  updatePlanUI(currentPlan);

  // Manipular alteração do select de planos
  if (planSelect) {
    planSelect.addEventListener('change', () => {
      updatePlanUI(planSelect.value);
      history.replaceState(null, '', `?plan=${encodeURIComponent(planSelect.value)}`);
    });
    setTimeout(() => {
      if (window.Emoji3D && window.Emoji3D.enhanceSelect) {
        window.Emoji3D.enhanceSelect(planSelect);
      }
    }, 60);
  }

  function showAlert(msg, type = 'error') {
    if (!paymentAlert) return;
    paymentAlert.textContent = msg;
    paymentAlert.className = `payment-alert show ${type}`;
  }

  function clearAlert() {
    if (!paymentAlert) return;
    paymentAlert.className = 'payment-alert';
    paymentAlert.textContent = '';
  }

  function setLoading(loading, text = 'Processando...') {
    if (!btnSubmit) return;
    btnSubmit.disabled = loading;
    if (btnSpinner) btnSpinner.style.display = loading ? 'inline-block' : 'none';
    if (btnText) btnText.textContent = loading ? text : 'Ativar Meus 7 Dias Grátis';
  }

  let stripe = null;
  let elements = null;

  async function initCheckout() {
    try {
      // 2. Verificar Autenticação do Usuário
      const authRes = await fetch('/api/auth/me', { credentials: 'include' });
      if (!authRes.ok) {
        window.location.href = `login.html?redirect=checkout&plan=${encodeURIComponent(currentPlan)}`;
        return;
      }
      const authData = await authRes.json();
      const user = authData.user;

      if (userName) userName.textContent = user.name || 'Concurseiro';
      if (userEmail) userEmail.textContent = user.email || '';
      if (userAvatar) userAvatar.textContent = (user.name || 'U').charAt(0).toUpperCase();

      // 3. Obter Chave Pública do Stripe
      const configRes = await fetch('/api/stripe/config');
      const configData = await configRes.json();
      if (!configData.publishable_key) {
        showAlert('Chave pública da Stripe não configurada no servidor.', 'error');
        return;
      }

      stripe = Stripe(configData.publishable_key);

      // 4. Criar SetupIntent na API para coleta segura com 7 dias de trial
      const setupRes = await fetch('/api/stripe/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan: currentPlan }),
      });
      const setupData = await setupRes.json();
      if (!setupRes.ok || !setupData.client_secret) {
        showAlert(setupData.error || 'Erro ao inicializar o checkout seguro.', 'error');
        return;
      }

      // 5. Configurar o Appearance API da Stripe com o tema escuro do LevelUp Study
      const appearance = {
        theme: 'night',
        variables: {
          colorPrimary: '#8b5cf6',
          colorBackground: '#17142b',
          colorText: '#f6f3ff',
          colorDanger: '#ef4444',
          fontFamily: 'Manrope, system-ui, sans-serif',
          borderRadius: '12px',
          spacingUnit: '4.5px',
          colorIconChevronDown: '#c4b5fd',
        },
        rules: {
          '.Input': {
            border: '1px solid rgba(196, 181, 253, 0.18)',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            color: '#f6f3ff',
            boxShadow: 'none',
          },
          '.Input:focus': {
            borderColor: '#8b5cf6',
            boxShadow: '0 0 0 2px rgba(139, 92, 246, 0.28)',
          },
          '.Label': {
            color: '#aba3c4',
            fontWeight: '600',
            fontSize: '0.86rem',
            marginBottom: '6px',
          },
          '.p-Select': {
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(196, 181, 253, 0.18)',
            borderRadius: '12px',
          },
          '.p-Select-select': {
            backgroundColor: '#15122a',
            color: '#f6f3ff',
          },
          '.p-InputIcon': {
            color: '#c4b5fd',
          },
          '.Select': {
            border: '1px solid rgba(196, 181, 253, 0.18)',
            backgroundColor: '#15122a',
            color: '#f6f3ff',
            padding: '12px 14px',
            borderRadius: '12px',
          },
          '.Select:focus': {
            borderColor: '#8b5cf6',
            boxShadow: '0 0 0 2px rgba(139, 92, 246, 0.28)',
          },
          '.Select--empty': {
            color: '#aba3c4',
          },
          '.Dropdown': {
            backgroundColor: '#17142b',
            border: '1px solid rgba(196, 181, 253, 0.25)',
            borderRadius: '12px',
            color: '#f6f3ff',
            boxShadow: '0 14px 40px rgba(0, 0, 0, 0.65)',
          },
          '.DropdownItem': {
            color: '#f6f3ff',
            padding: '10px 14px',
          },
          '.DropdownItem--selected': {
            backgroundColor: 'rgba(139, 92, 246, 0.25)',
            color: '#c4b5fd',
          },
          '.DropdownItem:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
          },
          '.Tab': {
            border: '1px solid rgba(196, 181, 253, 0.16)',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
          },
          '.Tab--selected': {
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
          }
        }
      };

      elements = stripe.elements({
        clientSecret: setupData.client_secret,
        appearance,
      });

      const paymentElement = elements.create('payment', {
        fields: {
          billingDetails: {
            name: 'never',
            email: 'never',
            phone: 'never',
            address: {
              country: 'never',
              postalCode: 'never',
            }
          }
        },
        defaultValues: {
          billingDetails: {
            name: user.name || '',
            email: user.email || '',
          }
        }
      });
      paymentElement.mount('#payment-element');

      paymentElement.on('ready', () => {
        if (btnSubmit) btnSubmit.disabled = false;
      });

      paymentElement.on('change', (event) => {
        if (event.error) {
          showAlert(event.error.message, 'error');
        } else {
          clearAlert();
        }
      });
    } catch (err) {
      console.error('Erro na inicialização do checkout:', err);
      showAlert('Não foi possível conectar aos servidores de pagamento. Verifique sua conexão.', 'error');
    }
  }

  // 6. Manipular o envio do formulário de pagamento
  if (paymentForm) {
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert();

      if (!stripe || !elements) {
        showAlert('O formulário de pagamento ainda não está pronto. Aguarde um instante.', 'error');
        return;
      }

      setLoading(true, 'Validando cartão seguro...');

      try {
        // Confirma o SetupIntent no Stripe com 3D Secure integrado se necessário
        const { setupIntent, error } = await stripe.confirmSetup({
          elements,
          redirect: 'if_required',
        });

        if (error) {
          showAlert(error.message || 'Falha ao validar os dados do cartão.', 'error');
          setLoading(false);
          return;
        }

        if (setupIntent && setupIntent.status === 'succeeded') {
          setLoading(true, 'Ativando seus 7 dias grátis...');

          // Chama a API para ativar a assinatura com o método de pagamento validado
          const actRes = await fetch('/api/stripe/activate-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              payment_method_id: setupIntent.payment_method,
              plan: currentPlan,
            }),
          });
          const actData = await actRes.json();

          if (!actRes.ok || !actData.success) {
            showAlert(actData.error || 'Erro ao concluir ativação da assinatura.', 'error');
            setLoading(false);
            return;
          }

          showAlert('✨ Parabéns! Seus 7 dias grátis do Concurseiro Pro foram ativados com sucesso! Redirecionando...', 'success');
          setTimeout(() => {
            window.location.href = actData.redirect_url || 'index.html?payment=success';
          }, 1200);
        } else {
          showAlert('Validação pendente ou não autorizada pelo banco emissor.', 'error');
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro ao processar pagamento:', err);
        showAlert('Erro inesperado ao processar o pagamento. Tente novamente em instantes.', 'error');
        setLoading(false);
      }
    });
  }

  initCheckout();
})();
