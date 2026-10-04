"""
LevelUp Study – Banco de Questões e Simulados para Concurseiros
Disciplinas fundamentais para concursos públicos com bancas renomadas (Cebraspe, FGV, FCC, Vunesp).
"""

CONCURSO_QUESTIONS = [
    # ── DIREITO CONSTITUCIONAL ──
    {
        "id": 1,
        "subject": "Direito Constitucional",
        "topic": "Direitos e Garantias Fundamentais",
        "banca": "Cebraspe",
        "year": 2024,
        "institution": "Tribunal Regional Federal",
        "question": "A respeito dos direitos e deveres individuais e coletivos previstos na Constituição Federal de 1988, é correto afirmar que:",
        "options": [
            "A casa é asilo inviolável do indivíduo, não podendo nela penetrar sem consentimento do morador, salvo durante a noite por determinação judicial.",
            "É livre a manifestação do pensamento, sendo expressamente permitido o anonimato em situações de denúncia.",
            "Homens e mulheres são iguais em direitos e obrigações, nos termos da Constituição.",
            "Ninguém será privado de direitos por motivo de crença religiosa, mesmo que se recuse a cumprir prestação alternativa fixada em lei."
        ],
        "correct": 2,
        "explanation": "Art. 5º, I, CF/88: 'homens e mulheres são iguais em direitos e obrigações, nos termos desta Constituição'. A determinação judicial só pode ser executada durante o dia (inciso XI), o anonimato é vedado (inciso IV), e a recusa à prestação alternativa acarreta privação de direitos (inciso VIII)."
    },
    {
        "id": 2,
        "subject": "Direito Constitucional",
        "topic": "Remédios Constitucionais",
        "banca": "FCC",
        "year": 2024,
        "institution": "Tribunal de Justiça",
        "question": "Conceder-se-á Mandado de Segurança para:",
        "options": [
            "Proteger direito líquido e certo, não amparado por habeas corpus ou habeas data, quando o responsável pela ilegalidade for autoridade pública.",
            "Garantir a liberdade de locomoção sempre que alguém sofrer ou se achar ameaçado de sofrer violência ou coação.",
            "Assegurar o conhecimento de informações relativas à pessoa do impetrante constantes de registros governamentais.",
            "Viabilizar o exercício dos direitos e liberdades constitucionais sempre que faltar norma regulamentadora."
        ],
        "correct": 0,
        "explanation": "Art. 5º, LXIX, CF/88: 'conceder-se-á mandado de segurança para proteger direito líquido e certo, não amparado por habeas corpus ou habeas data, quando o responsável pela ilegalidade ou abuso de poder for autoridade pública ou agente de pessoa jurídica no exercício de atribuições do Poder Público'."
    },
    {
        "id": 3,
        "subject": "Direito Constitucional",
        "topic": "Princípios Fundamentais",
        "banca": "FGV",
        "year": 2023,
        "institution": "Receita Federal",
        "question": "Constitui um dos objetivos fundamentais da República Federativa do Brasil, expressamente previsto no art. 3º da CF/88:",
        "options": [
            "A soberania e a cidadania.",
            "A dignidade da pessoa humana e os valores sociais do trabalho.",
            "O pluralismo político e a prevalência dos direitos humanos.",
            "Construir uma sociedade livre, justa e solidária."
        ],
        "correct": 3,
        "explanation": "Art. 3º, I, CF/88. Construir uma sociedade livre, justa e solidária é um objetivo fundamental. Os demais itens elencados nas outras alternativas são fundamentos da República (Art. 1º) ou princípios nas relações internacionais (Art. 4º)."
    },
    {
        "id": 4,
        "subject": "Direito Constitucional",
        "topic": "Organização do Estado",
        "banca": "Cebraspe",
        "year": 2024,
        "institution": "Polícia Federal",
        "question": "A respeito da divisão de competências na Federação Brasileira, compete privativamente à União legislar sobre:",
        "options": [
            "Direito civil, comercial, penal, processual, eleitoral, agrário, marítimo, aeronáutico, espacial e do trabalho.",
            "Direito tributário, financeiro, penitenciário, econômico e urbanístico.",
            "Previdência social, proteção e defesa da saúde.",
            "Florestas, caça, pesca, fauna, conservação da natureza e defesa do solo."
        ],
        "correct": 0,
        "explanation": "Art. 22, I, da CF/88. Compete privativamente à União legislar sobre direito civil, comercial, penal, processual, eleitoral, etc. As demais matérias citadas pertencem à competência legislativa concorrente (Art. 24)."
    },

    # ── DIREITO ADMINISTRATIVO ──
    {
        "id": 5,
        "subject": "Direito Administrativo",
        "topic": "Princípios da Administração Pública",
        "banca": "Cebraspe",
        "year": 2024,
        "institution": "INSS",
        "question": "O princípio constitucional da administração pública que veda a promoção pessoal de agentes públicos em obras, serviços e campanhas de órgãos estatais é o princípio da:",
        "options": [
            "Legalidade.",
            "Impessoalidade.",
            "Eficiência.",
            "Publicidade."
        ],
        "correct": 1,
        "explanation": "Art. 37, § 1º, da CF/88. O princípio da impessoalidade estabelece que a publicidade dos atos governamentais deve ter caráter educativo, informativo ou de orientação social, sem nomes, símbolos ou imagens que caracterizem promoção pessoal."
    },
    {
        "id": 6,
        "subject": "Direito Administrativo",
        "topic": "Poderes Administrativos",
        "banca": "FGV",
        "year": 2024,
        "institution": "Tribunal de Contas",
        "question": "A prerrogativa concedida à Administração Pública para condicionar e restringir o uso de bens, atividades e direitos individuais em prol do interesse da coletividade denomina-se:",
        "options": [
            "Poder Disciplinar.",
            "Poder Hierárquico.",
            "Poder de Polícia.",
            "Poder Regulamentar."
        ],
        "correct": 2,
        "explanation": "O Poder de Polícia é a atividade da administração pública que limita ou disciplina direito, interesse ou liberdade, regulando a prática de ato ou abstenção de fato, em razão do interesse público (Art. 78 do CTN)."
    },
    {
        "id": 7,
        "subject": "Direito Administrativo",
        "topic": "Atos Administrativos",
        "banca": "FCC",
        "year": 2023,
        "institution": "TRT",
        "question": "São requisitos (elementos) indispensáveis de validade do ato administrativo:",
        "options": [
            "Competência, finalidade, forma, motivo e objeto.",
            "Imperatividade, autoexecutoriedade e presunção de legitimidade.",
            "Revogabilidade, convalidação e tipicidade.",
            "Discricionariedade, legalidade, mérito e conveniência."
        ],
        "correct": 0,
        "explanation": "Mnemônico clássico 'COM-FI-FOR-M-OB': Competência, Finalidade, Forma, Motivo e Objeto (Lei 4.717/65, art. 2º). A alternativa B traz atributos do ato, e não requisitos."
    },
    {
        "id": 8,
        "subject": "Direito Administrativo",
        "topic": "Nova Lei de Licitações (Lei 14.133/21)",
        "banca": "Vunesp",
        "year": 2024,
        "institution": "Prefeitura Municipal",
        "question": "De acordo com a Lei nº 14.133/2021 (Nova Lei de Licitações), assinale a nova modalidade de licitação introduzida no ordenamento jurídico brasileiro:",
        "options": [
            "Tomada de Preços.",
            "Convite.",
            "Diálogo Competitivo.",
            "Consulta."
        ],
        "correct": 2,
        "explanation": "A Lei 14.133/2021 extinguiu o Convite e a Tomada de Preços e introduziu o Diálogo Competitivo (Art. 28, V) como nova modalidade licitatória para contratações complexas e inovações."
    },

    # ── LÍNGUA PORTUGUESA PARA CONCURSOS ──
    {
        "id": 9,
        "subject": "Língua Portuguesa",
        "topic": "Crase",
        "banca": "FGV",
        "year": 2024,
        "institution": "Secretaria de Fazenda",
        "question": "Assinale a frase em que o uso do acento grave indicativo da crase está CORRETO:",
        "options": [
            "O candidato se dirigiu à pé até o local da prova.",
            "O edital foi entregue à todos os candidatos inscritos.",
            "Ele sempre foi fiel à essa teoria jurídica.",
            "Os concurseiros assistiram à aula de revisão com entusiasmo."
        ],
        "correct": 3,
        "explanation": "O verbo 'assistir' no sentido de presenciar/ver exige a preposição 'a'. Como 'aula' é substantivo feminino determinado pelo artigo 'a', ocorre a fusão: a + a = à. Não há crase antes de palavras masculinas ('pé'), pronomes indefinidos ('todos') ou demonstrativos ('essa')."
    },
    {
        "id": 10,
        "subject": "Língua Portuguesa",
        "topic": "Concordância Verbal",
        "banca": "Cebraspe",
        "year": 2024,
        "institution": "Polícia Rodoviária Federal",
        "question": "Assinale a alternativa que atende plenamente à norma-padrão de concordância verbal:",
        "options": [
            "Haviam muitas dúvidas entre os estudantes da sala.",
            "Fazem três anos que me preparo para este concurso público.",
            "Trata-se de decisões complexas adotadas pela corte.",
            "Devem haver razões plausíveis para a decisão da banca."
        ],
        "correct": 2,
        "explanation": "Na oração com sujeito indeterminado (verbo transitivo indireto + se), o verbo fica na 3ª pessoa do singular ('Trata-se de...'). Os verbos 'haver' (sentido de existir) e 'fazer' (tempo decorrido) são impessoais e não vão para o plural ('Havia muitas dúvidas', 'Faz três anos', 'Deve haver razões')."
    },
    {
        "id": 11,
        "subject": "Língua Portuguesa",
        "topic": "Pontuação e Sintaxe",
        "banca": "FCC",
        "year": 2023,
        "institution": "Tribunal Regional Eleitoral",
        "question": "O emprego da vírgula está inteiramente de acordo com a norma-padrão em:",
        "options": [
            "O concurseiro comprou, todos os livros indicados pelo edital.",
            "Com dedicação e disciplina diária, o candidato conquistou sua vaga.",
            "Os alunos que estudaram muito, foram aprovados no concurso.",
            "O professor de direito explicou, a matéria com clareza exemplar."
        ],
        "correct": 1,
        "explanation": "A oração apresenta um adjunto adverbial de modo/instrumento anteposto de longa extensão ('Com dedicação e disciplina diária,'), o que torna a vírgula obrigatória e correta. Não se separa sujeito de predicado nem verbo de seu objeto com vírgula."
    },

    # ── RACIOCÍNIO LÓGICO E MATEMÁTICO ──
    {
        "id": 12,
        "subject": "Raciocínio Lógico",
        "topic": "Negação de Proposições Compostas",
        "banca": "Cebraspe",
        "year": 2024,
        "institution": "Caixa Econômica Federal",
        "question": "A negação lógica da proposição composta 'Carlos é estudioso e Maria é aprovada' é expressa por:",
        "options": [
            "Carlos não é estudioso e Maria não é aprovada.",
            "Carlos não é estudioso ou Maria não é aprovada.",
            "Carlos é estudioso ou Maria é aprovada.",
            "Se Carlos não for estudioso, então Maria não é aprovada."
        ],
        "correct": 1,
        "explanation": "Pela Primeira Lei de De Morgan: ~(P ∧ Q) ≡ (~P ∨ ~Q). A negação da conjunção 'e' troca o conectivo por 'ou' e nega ambas as proposições simples ('Carlos não é estudioso OU Maria não é aprovada')."
    },
    {
        "id": 13,
        "subject": "Raciocínio Lógico",
        "topic": "Equivalência Lógica do Condicional",
        "banca": "FGV",
        "year": 2023,
        "institution": "Assembleia Legislativa",
        "question": "A proposição logicamente equivalente a 'Se o aluno treina simulados, então ele passa no concurso' é:",
        "options": [
            "Se o aluno não treina simulados, então ele não passa no concurso.",
            "Se o aluno passou no concurso, então ele treinou simulados.",
            "Se o aluno não passa no concurso, então ele não treina simulados.",
            "O aluno treina simulados e não passa no concurso."
        ],
        "correct": 2,
        "explanation": "A equivalência da contrapositiva do condicional: (P → Q) ≡ (~Q → ~P). 'Se não passou no concurso, então não treina simulados'."
    },
    {
        "id": 14,
        "subject": "Raciocínio Lógico",
        "topic": "Análise Combinatória",
        "banca": "Vunesp",
        "year": 2024,
        "institution": "Ministério Público",
        "question": "Uma comissão de concurso público é composta por 5 professores. Deseja-se escolher 3 deles para a banca examinadora. O número de maneiras distintas de formar essa banca é igual a:",
        "options": [
            "10",
            "15",
            "20",
            "60"
        ],
        "correct": 0,
        "explanation": "Como a ordem dos membros na banca não importa, trata-se de combinação simples: C(5, 3) = 5! / (3! * 2!) = (5 * 4) / 2 = 10 maneiras distintas."
    },

    # ── NOÇÕES DE INFORMÁTICA PARA CONCURSOS ──
    {
        "id": 15,
        "subject": "Noções de Informática",
        "topic": "Segurança da Informação",
        "banca": "Cebraspe",
        "year": 2024,
        "institution": "Tribunal de Justiça",
        "question": "O tipo de código malicioso (malware) que sequestra dados de um computador através de criptografia e exige pagamento de resgate para restabelecer o acesso é chamado de:",
        "options": [
            "Spyware.",
            "Ransomware.",
            "Worm.",
            "Keylogger."
        ],
        "correct": 1,
        "explanation": "Ransomware é o malware extorsivo que cifra arquivos ou restringe o acesso ao sistema, cobrando um resgate (normalmente em criptomoedas) para fornecer a chave de descriptografia."
    },
    {
        "id": 16,
        "subject": "Noções de Informática",
        "topic": "Redes e Navegação Segura",
        "banca": "FCC",
        "year": 2023,
        "institution": "Defensoria Pública",
        "question": "No protocolo HTTPS, a segurança das comunicações na Web é garantida pela combinação do protocolo HTTP com o protocolo de criptografia:",
        "options": [
            "DNS.",
            "FTP.",
            "SSL/TLS.",
            "DHCP."
        ],
        "correct": 2,
        "explanation": "HTTPS (HyperText Transfer Protocol Secure) adiciona uma camada de criptografia e integridade sobre o HTTP por meio de certificados SSL (Secure Sockets Layer) ou TLS (Transport Layer Security)."
    }
]


def get_subjects():
    """Retorna lista única de matérias disponíveis no banco de concursos."""
    return sorted(list(set(q["subject"] for q in CONCURSO_QUESTIONS)))


def get_bancas():
    """Retorna lista de bancas organizadoras cadastradas."""
    return sorted(list(set(q["banca"] for q in CONCURSO_QUESTIONS)))


def get_concurseiro_questions(subject=None, banca=None, limit=10, is_premium=False):
    """
    Filtra e retorna questões com base no plano do usuário.
    Usuários Free têm acesso a até 3 questões de degustação.
    Usuários Premium têm acesso total ilimitado.
    """
    filtered = list(CONCURSO_QUESTIONS)

    if subject and subject.lower() != "todas":
        filtered = [q for q in filtered if q["subject"].lower() == subject.lower()]

    if banca and banca.lower() != "todas":
        filtered = [q for q in filtered if q["banca"].lower() == banca.lower()]

    # Regra de Negócio do Canvas: Free é degustação (máx 3), Pro é ilimitado
    max_items = limit
    if not is_premium:
        max_items = min(limit, 3)

    selected = filtered[:max_items]

    # Higienização para envio ao frontend (não expõe gabarito antes da resposta)
    public_questions = []
    for item in selected:
        public_questions.append({
            "id": item["id"],
            "subject": item["subject"],
            "topic": item["topic"],
            "banca": item["banca"],
            "year": item["year"],
            "institution": item["institution"],
            "question": item["question"],
            "options": item["options"],
            "is_preview": not is_premium
        })

    return {
        "questions": public_questions,
        "total_available": len(filtered),
        "is_preview": not is_premium,
        "free_limit_applied": not is_premium and len(filtered) > 3,
        "upgrade_required_for_full": not is_premium
    }


def evaluate_concurseiro_simulado(submissions: list, is_premium=False):
    """
    Avalia as respostas do simulado de concurso.
    Retorna pontuação, gabarito comentado e cálculo de XP ganho.
    """
    total = len(submissions)
    correct_count = 0
    feedback_list = []
    questions_map = {q["id"]: q for q in CONCURSO_QUESTIONS}

    for sub in submissions:
        qid = sub.get("question_id")
        choice = sub.get("selected_option")
        q = questions_map.get(qid)

        if not q:
            continue

        is_correct = (choice == q["correct"])
        if is_correct:
            correct_count += 1

        feedback_list.append({
            "question_id": qid,
            "subject": q["subject"],
            "topic": q["topic"],
            "banca": q["banca"],
            "user_choice": choice,
            "correct_option": q["correct"],
            "is_correct": is_correct,
            # Se for premium, tem acesso ao comentário pedagógico completo e detalhado
            "explanation": q["explanation"] if is_premium else (
                q["explanation"] if is_correct else "Assine o Concurseiro Pro para ver o gabarito comentado detalhado e dicas da IA."
            )
        })

    accuracy_pct = round((correct_count / total * 100), 1) if total > 0 else 0
    # Cada acerto concede 15 XP
    xp_awarded = correct_count * 15

    return {
        "total_questions": total,
        "correct_count": correct_count,
        "accuracy_pct": accuracy_pct,
        "xp_awarded": xp_awarded,
        "results": feedback_list,
        "is_premium": is_premium
    }
