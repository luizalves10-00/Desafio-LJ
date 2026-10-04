"""
Módulo de Sincronização Automática de Planos do LevelUp Study com o Stripe.

Cria ou localiza o Produto 'LevelUp Study - Concurseiro Pro' e os Preços
Mensal (R$ 19,90/mês) e Anual (R$ 199,00/ano) na conta da Stripe,
e atualiza automaticamente o arquivo .env com os IDs gerados.
"""

import os
import re
import stripe

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")


def sync_plans_with_stripe(api_key: str = None) -> dict:
    """
    Sincroniza os planos do LevelUp Study com o Stripe.
    Retorna os IDs do produto e dos preços criados ou existentes.
    """
    if not api_key:
        api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not api_key:
        raise ValueError("STRIPE_SECRET_KEY não encontrada nas variáveis de ambiente.")

    stripe.api_key = api_key

    # 1. Localizar ou Criar Produto no Stripe
    existing_prods = stripe.Product.list(limit=50, active=True)
    levelup_prod = None
    for p in existing_prods.data:
        meta = p.metadata.to_dict() if hasattr(p, "metadata") and p.metadata else {}
        if meta.get("app") == "levelup_study" or "LevelUp Study" in (p.name or ""):
            levelup_prod = p
            break

    if not levelup_prod:
        levelup_prod = stripe.Product.create(
            name="LevelUp Study - Concurseiro Pro",
            description="Acesso ilimitado com Mentor IA, Banco de Questões de Concursos, Simulados por Banca e Gamificação RPG.",
            metadata={
                "app": "levelup_study",
                "project": "LevelUp Study",
                "environment": "production"
            }
        )

    # 2. Localizar ou Criar Preços (Mensal: R$ 19,90 / Anual: R$ 199,00)
    existing_prices = stripe.Price.list(product=levelup_prod.id, active=True)
    monthly_price = None
    yearly_price = None

    for pr in existing_prices.data:
        interval = pr.recurring.interval if pr.recurring else None
        if interval == "month" and pr.unit_amount == 1990:
            monthly_price = pr
        elif interval == "year" and pr.unit_amount == 19900:
            yearly_price = pr

    if not monthly_price:
        monthly_price = stripe.Price.create(
            product=levelup_prod.id,
            unit_amount=1990,
            currency="brl",
            recurring={"interval": "month"},
            nickname="Concurseiro Pro Mensal",
            metadata={
                "app": "levelup_study",
                "plan_key": "hero_monthly"
            }
        )

    if not yearly_price:
        yearly_price = stripe.Price.create(
            product=levelup_prod.id,
            unit_amount=19900,
            currency="brl",
            recurring={"interval": "year"},
            nickname="Concurseiro Pro Anual",
            metadata={
                "app": "levelup_study",
                "plan_key": "hero_yearly"
            }
        )

    result = {
        "ok": True,
        "product_id": levelup_prod.id,
        "product_name": levelup_prod.name,
        "monthly_price_id": monthly_price.id,
        "monthly_amount": 19.90,
        "yearly_price_id": yearly_price.id,
        "yearly_amount": 199.00,
        "currency": "brl"
    }

    # 3. Atualizar o arquivo .env automaticamente
    update_env_file(
        product_id=levelup_prod.id,
        monthly_id=monthly_price.id,
        yearly_id=yearly_price.id
    )

    return result


def update_env_file(product_id: str, monthly_id: str, yearly_id: str):
    """Atualiza as variáveis STRIPE_PRODUCT_ID, STRIPE_PRICE_MONTHLY e STRIPE_PRICE_YEARLY no .env."""
    if not os.path.exists(ENV_PATH):
        return

    with open(ENV_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Atualiza ou adiciona STRIPE_PRODUCT_ID
    if "STRIPE_PRODUCT_ID=" in content:
        content = re.sub(r"STRIPE_PRODUCT_ID=.*", f"STRIPE_PRODUCT_ID={product_id}", content)
    else:
        content += f"\nSTRIPE_PRODUCT_ID={product_id}"

    # Atualiza STRIPE_PRICE_MONTHLY
    if "STRIPE_PRICE_MONTHLY=" in content:
        content = re.sub(r"STRIPE_PRICE_MONTHLY=.*", f"STRIPE_PRICE_MONTHLY={monthly_id}", content)
    else:
        content += f"\nSTRIPE_PRICE_MONTHLY={monthly_id}"

    # Atualiza STRIPE_PRICE_YEARLY
    if "STRIPE_PRICE_YEARLY=" in content:
        content = re.sub(r"STRIPE_PRICE_YEARLY=.*", f"STRIPE_PRICE_YEARLY={yearly_id}", content)
    else:
        content += f"\nSTRIPE_PRICE_YEARLY={yearly_id}"

    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    # Atualiza também no ambiente do processo atual
    os.environ["STRIPE_PRODUCT_ID"] = product_id
    os.environ["STRIPE_PRICE_MONTHLY"] = monthly_id
    os.environ["STRIPE_PRICE_YEARLY"] = yearly_id


if __name__ == "__main__":
    import dotenv
    dotenv.load_dotenv(ENV_PATH, override=True)
    print("=" * 65)
    print("LevelUp Study - Sincronizacao de Planos com o Stripe (Live)")
    print("=" * 65)
    try:
        data = sync_plans_with_stripe()
        print("\n[OK] Planos sincronizados com sucesso no Stripe!")
        print(f"Produto : {data['product_name']} ({data['product_id']})")
        print(f"Mensal  : R$ {data['monthly_amount']:.2f} / mes -> {data['monthly_price_id']}")
        print(f"Anual   : R$ {data['yearly_amount']:.2f} / ano  -> {data['yearly_price_id']}")
        print(f"\nArquivo .env atualizado com sucesso em: {ENV_PATH}")
    except Exception as e:
        print(f"\n[ERRO] Falha na sincronizacao com o Stripe: {e}")
