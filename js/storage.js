/**
 * FeiraFinance — Storage Layer
 * Camada de abstração e persistência em localStorage
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'feirafinance_transactions_v1',
  BOOTHS: 'feirafinance_booths_v1',
  SETTINGS: 'feirafinance_settings_v1',
  CATEGORIES: 'feirafinance_categories_v1',
  THEME: 'feirafinance_theme_v1',
};

// Categorias padrão
export const DEFAULT_CATEGORIES = {
  income: [
    'Aluguel de Estande',
    'Venda de Ingressos',
    'Patrocínio Master',
    'Cota de Alimentação',
    'Estacionamento',
    'Merchandising & Brindes',
    'Espaço Kids / Atrações',
    'Outras Receitas'
  ],
  expense: [
    'Segurança & Vigilância',
    'Limpeza & Resíduos',
    'Palco, Som & Iluminação',
    'Gerador & Energia',
    'Marketing & Redes Sociais',
    'Licenças & Taxas Públicas',
    'Decoração & Sinalização',
    'Equipe de Apoio & Recepção',
    'Banheiros Químicos',
    'Outras Despesas'
  ]
};

// Configurações padrão
export const DEFAULT_SETTINGS = {
  fairName: 'Feira do Bairro',
  edition: '12ª Edição Anual',
  dateStart: '2026-11-10',
  dateEnd: '2026-11-15',
  location: 'Pavilhão de Exposições Central',
  currency: 'BRL',
  targetGoal: 35000, // Meta de Arrecadação Bruta (R$)
  initialCash: 1500, // Fundo de Troco / Caixa Inicial (R$)
  soundEnabled: true,
};

function getDateOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 12 Estandes demonstrativos pré-configurados para a feira
 */
export function generateDemoBooths() {
  return [
    {
      id: 'bth_01',
      number: 'Estande 01',
      exhibitor: 'Delícias da Vovó - Doces Caseiros',
      sector: 'Gastronomia',
      price: 1200.00,
      paidAmount: 1200.00,
      status: 'paid',
      contact: '(11) 98765-4321',
      notes: 'Ponto elétrico 110V incluso.'
    },
    {
      id: 'bth_02',
      number: 'Estande 02',
      exhibitor: 'Artesanato em Barro & Cerâmica',
      sector: 'Artesanato',
      price: 850.00,
      paidAmount: 850.00,
      status: 'paid',
      contact: '(11) 97654-3210',
      notes: 'Bancada reforçada solicitada.'
    },
    {
      id: 'bth_03',
      number: 'Estande 03',
      exhibitor: 'Cafés Selecionados do Cerrado',
      sector: 'Gastronomia',
      price: 1100.00,
      paidAmount: 550.00,
      status: 'partial',
      contact: '(11) 96543-2109',
      notes: '2ª parcela no primeiro dia do evento.'
    },
    {
      id: 'bth_04',
      number: 'Estande 04',
      exhibitor: 'EcoModa Sustentável & Acessórios',
      sector: 'Moda',
      price: 950.00,
      paidAmount: 950.00,
      status: 'paid',
      contact: '(11) 95432-1098',
      notes: 'Expositor de vestuário orgânico.'
    },
    {
      id: 'bth_05',
      number: 'Estande 05',
      exhibitor: 'Cervejaria Artesanal Raízes',
      sector: 'Gastronomia',
      price: 1600.00,
      paidAmount: 1600.00,
      status: 'paid',
      contact: '(11) 94321-0987',
      notes: 'Chopeira com ligação 220V.'
    },
    {
      id: 'bth_06',
      number: 'Estande 06',
      exhibitor: 'Luminárias em Madeira de Demolição',
      sector: 'Artesanato',
      price: 850.00,
      paidAmount: 0.00,
      status: 'pending',
      contact: '(11) 93210-9876',
      notes: 'Aguardando comprovante de PIX.'
    },
    {
      id: 'bth_07',
      number: 'Estande 07',
      exhibitor: 'Queijos da Serra da Canastra',
      sector: 'Gastronomia',
      price: 1300.00,
      paidAmount: 1300.00,
      status: 'paid',
      contact: '(11) 92109-8765',
      notes: 'Balcão refrigerado.'
    },
    {
      id: 'bth_08',
      number: 'Estande 08',
      exhibitor: 'Cosméticos Naturais Botânica',
      sector: 'Saúde & Beleza',
      price: 900.00,
      paidAmount: 450.00,
      status: 'partial',
      contact: '(11) 91098-7654',
      notes: 'Restante via Cartão de Débito.'
    },
    {
      id: 'bth_09',
      number: 'Estande 09',
      exhibitor: 'Plantas Ornamentais & Suculentas',
      sector: 'Paisagismo',
      price: 800.00,
      paidAmount: 800.00,
      status: 'paid',
      contact: '(11) 99887-6655',
      notes: 'Área com luz solar direta.'
    },
    {
      id: 'bth_10',
      number: 'Estande 10',
      exhibitor: 'Hamburgueria na Brasa Truck',
      sector: 'Gastronomia',
      price: 1800.00,
      paidAmount: 1800.00,
      status: 'paid',
      contact: '(11) 98776-5544',
      notes: 'Espaço 4x4m com exaustão.'
    },
    {
      id: 'bth_11',
      number: 'Estande 11',
      exhibitor: 'Papelaria Criativa & Encadernação',
      sector: 'Artesanato',
      price: 750.00,
      paidAmount: 750.00,
      status: 'paid',
      contact: '(11) 97665-4433',
      notes: 'Módulo lateral.'
    },
    {
      id: 'bth_12',
      number: 'Estande 12',
      exhibitor: 'Espaço Tech - Realidade Virtual',
      sector: 'Tecnologia',
      price: 1500.00,
      paidAmount: 0.00,
      status: 'pending',
      contact: '(11) 96554-3322',
      notes: 'Necessita link dedicado de internet.'
    }
  ];
}

/**
 * Gera 20 lançamentos realistas de demonstração (12 receitas, 8 despesas)
 */
export function generateDemoTransactions() {
  return [
    // 12 Recebimentos
    {
      id: 'tx_rec_01',
      type: 'income',
      description: 'Cota Patrocínio Master - Cooperativa Local',
      category: 'Patrocínio Master',
      amount: 4800.00,
      date: getDateOffset(75),
      paymentMethod: 'Transferência Bancária',
      responsible: 'Mariana Duarte (Comercial)',
      notes: 'Contrato com exclusividade na praça de eventos.'
    },
    {
      id: 'tx_rec_02',
      type: 'income',
      description: 'Aluguel Estandes 01 ao 04 - Setor Gastronomia',
      category: 'Aluguel de Estande',
      amount: 3200.00,
      date: getDateOffset(68),
      paymentMethod: 'PIX',
      responsible: 'Carlos Silva (Tesouraria)',
      notes: '4 expositores de comida de rua e doces.'
    },
    {
      id: 'tx_rec_03',
      type: 'income',
      description: 'Lote Antecipado de Ingressos - 1ª Semana',
      category: 'Venda de Ingressos',
      amount: 1450.00,
      date: getDateOffset(55),
      paymentMethod: 'Cartão de Crédito',
      responsible: 'Bilheteria Online',
      notes: 'Total de 145 ingressos promocionais vendidos.'
    },
    {
      id: 'tx_rec_04',
      type: 'income',
      description: 'Aluguel Estande 02 - Artesanato em Cerâmica',
      category: 'Aluguel de Estande',
      amount: 850.00,
      date: getDateOffset(50),
      paymentMethod: 'PIX',
      responsible: 'Carlos Silva (Tesouraria)',
      notes: 'Espaço 3x3m com bancada inclusa.'
    },
    {
      id: 'tx_rec_05',
      type: 'income',
      description: 'Cota de Alimentação - Food Trucks Externos',
      category: 'Cota de Alimentação',
      amount: 2100.00,
      date: getDateOffset(42),
      paymentMethod: 'Transferência Bancária',
      responsible: 'Associação de Food Trucks',
      notes: '3 caminhões com taxa fixa de participação.'
    },
    {
      id: 'tx_rec_06',
      type: 'income',
      description: 'Aluguel Estandes 04 e 05 - Moda e Cervejaria',
      category: 'Aluguel de Estande',
      amount: 2550.00,
      date: getDateOffset(35),
      paymentMethod: 'Cartão de Débito',
      responsible: 'Mariana Duarte (Comercial)',
      notes: 'Dois módulos integrados.'
    },
    {
      id: 'tx_rec_07',
      type: 'income',
      description: 'Venda de Camisetas e Ecobags da Feira',
      category: 'Merchandising & Brindes',
      amount: 680.00,
      date: getDateOffset(28),
      paymentMethod: 'PIX',
      responsible: 'Loja Oficial do Evento',
      notes: 'Vendas no pré-evento e redes sociais.'
    },
    {
      id: 'tx_rec_08',
      type: 'income',
      description: 'Taxa de Credenciamento Espaço Kids',
      category: 'Espaço Kids / Atrações',
      amount: 1200.00,
      date: getDateOffset(20),
      paymentMethod: 'Boleto Bancário',
      responsible: 'Recreações Infantis Alegria',
      notes: 'Autorização e taxa de concessão de espaço infantil.'
    },
    {
      id: 'tx_rec_09',
      type: 'income',
      description: 'Aluguel Estande 07 - Queijos da Serra',
      category: 'Aluguel de Estande',
      amount: 1300.00,
      date: getDateOffset(14),
      paymentMethod: 'PIX',
      responsible: 'Carlos Silva (Tesouraria)',
      notes: 'Estande com ponto elétrico 220v dedicado.'
    },
    {
      id: 'tx_rec_10',
      type: 'income',
      description: 'Patrocínio Mídia e Banner de Entrada',
      category: 'Patrocínio Master',
      amount: 2500.00,
      date: getDateOffset(10),
      paymentMethod: 'Transferência Bancária',
      responsible: 'Agência Criativa Regional',
      notes: 'Logomarca no portal de entrada e sacolas.'
    },
    {
      id: 'tx_rec_11',
      type: 'income',
      description: 'Venda de Ingressos Portaria - Lote 2',
      category: 'Venda de Ingressos',
      amount: 3840.00,
      date: getDateOffset(5),
      paymentMethod: 'Cartão de Crédito',
      responsible: 'Bilheteria Central',
      notes: 'Público geral do fim de semana.'
    },
    {
      id: 'tx_rec_12',
      type: 'income',
      description: 'Concessão Estacionamento Visitantes',
      category: 'Estacionamento',
      amount: 1950.00,
      date: getDateOffset(2),
      paymentMethod: 'Dinheiro',
      responsible: 'Operadora EstacioneBem',
      notes: 'Repasse percentual de 35% da arrecadação de vagas.'
    },

    // 8 Pagamentos
    {
      id: 'tx_desp_01',
      type: 'expense',
      description: 'Contratação Equipe de Segurança e Brigadistas',
      category: 'Segurança & Vigilância',
      amount: 3200.00,
      date: getDateOffset(70),
      paymentMethod: 'Transferência Bancária',
      responsible: 'GuardaForte Vigilância',
      notes: '6 vigilantes + 2 brigadistas durante todo o período.'
    },
    {
      id: 'tx_desp_02',
      type: 'expense',
      description: 'Locação de Palco, Sistema de Som e Iluminação',
      category: 'Palco, Som & Iluminação',
      amount: 4200.00,
      date: getDateOffset(60),
      paymentMethod: 'Boleto Bancário',
      responsible: 'Acústica Show Eventos',
      notes: 'Montagem, teste de equalização e operador de som.'
    },
    {
      id: 'tx_desp_03',
      type: 'expense',
      description: 'Campanha de Marketing e Tráfego Pago',
      category: 'Marketing & Redes Sociais',
      amount: 1250.00,
      date: getDateOffset(48),
      paymentMethod: 'Cartão de Crédito',
      responsible: 'Agência Digital Foco',
      notes: 'Anúncios no Instagram e rádio comunitária.'
    },
    {
      id: 'tx_desp_04',
      type: 'expense',
      description: 'Aluguel e Combustível para Gerador 150kVA',
      category: 'Gerador & Energia',
      amount: 1800.00,
      date: getDateOffset(30),
      paymentMethod: 'PIX',
      responsible: 'Geradores Brasil Ltda',
      notes: 'Garantia de backup elétrico para freezers e palco.'
    },
    {
      id: 'tx_desp_05',
      type: 'expense',
      description: 'Locação e Manutenção de Banheiros Químicos',
      category: 'Banheiros Químicos',
      amount: 1400.00,
      date: getDateOffset(22),
      paymentMethod: 'Transferência Bancária',
      responsible: 'Sanitários Clean',
      notes: '8 cabines padrão + 2 cabines acessíveis com higienização.'
    },
    {
      id: 'tx_desp_06',
      type: 'expense',
      description: 'Taxa de Alvará de Funcionamento e Vistoria',
      category: 'Licenças & Taxas Públicas',
      amount: 780.00,
      date: getDateOffset(16),
      paymentMethod: 'Boleto Bancário',
      responsible: 'Prefeitura Municipal',
      notes: 'Protocolo de aprovação do Corpo de Bombeiros.'
    },
    {
      id: 'tx_desp_07',
      type: 'expense',
      description: 'Serviço Contínuo de Limpeza e Coleta Seletiva',
      category: 'Limpeza & Resíduos',
      amount: 1650.00,
      date: getDateOffset(8),
      paymentMethod: 'PIX',
      responsible: 'Cooperativa ReciclaMais',
      notes: 'Equipe de 5 auxiliares e destinação correta de lixo.'
    },
    {
      id: 'tx_desp_08',
      type: 'expense',
      description: 'Impressão de Faixas, Crachás e Sinalização',
      category: 'Decoração & Sinalização',
      amount: 890.00,
      date: getDateOffset(3),
      paymentMethod: 'PIX',
      responsible: 'Gráfica Expressa',
      notes: 'Mapas dos estandes, faixas de orientação e crachás.'
    }
  ];
}

export const Storage = {
  getTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (!raw) {
        const demo = generateDemoTransactions();
        this.saveTransactions(demo);
        return demo;
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error('Erro ao ler transações:', e);
      return [];
    }
  },

  saveTransactions(transactions) {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
      return true;
    } catch (e) {
      console.error('Erro ao salvar transações:', e);
      return false;
    }
  },

  addTransaction(transaction) {
    const list = this.getTransactions();
    const newTx = {
      id: transaction.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: transaction.type,
      description: transaction.description.trim(),
      category: transaction.category,
      amount: Number(transaction.amount),
      date: transaction.date,
      paymentMethod: transaction.paymentMethod,
      responsible: (transaction.responsible || '').trim(),
      notes: (transaction.notes || '').trim(),
      createdAt: new Date().toISOString()
    };
    list.unshift(newTx);
    this.saveTransactions(list);
    return newTx;
  },

  updateTransaction(id, updatedData) {
    const list = this.getTransactions();
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return null;

    list[index] = {
      ...list[index],
      ...updatedData,
      amount: Number(updatedData.amount),
      description: updatedData.description.trim(),
      responsible: (updatedData.responsible || '').trim(),
      notes: (updatedData.notes || '').trim(),
      updatedAt: new Date().toISOString()
    };

    this.saveTransactions(list);
    return list[index];
  },

  deleteTransaction(id) {
    const list = this.getTransactions();
    const filtered = list.filter(item => item.id !== id);
    this.saveTransactions(filtered);
    return filtered.length < list.length;
  },

  deleteTransactions(ids) {
    const set = new Set(ids);
    const list = this.getTransactions();
    const filtered = list.filter(item => !set.has(item.id));
    this.saveTransactions(filtered);
    return list.length - filtered.length;
  },

  // Estandes & Expositores
  getBooths() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BOOTHS);
      if (!raw) {
        const demo = generateDemoBooths();
        this.saveBooths(demo);
        return demo;
      }
      return JSON.parse(raw);
    } catch (e) {
      return generateDemoBooths();
    }
  },

  saveBooths(booths) {
    try {
      localStorage.setItem(STORAGE_KEYS.BOOTHS, JSON.stringify(booths));
      return true;
    } catch (e) {
      return false;
    }
  },

  updateBooth(id, data) {
    const booths = this.getBooths();
    const idx = booths.findIndex(b => b.id === id);
    if (idx === -1) return null;
    booths[idx] = { ...booths[idx], ...data };
    this.saveBooths(booths);
    return booths[idx];
  },

  addBooth(booth) {
    const booths = this.getBooths();
    const newB = {
      id: booth.id || `bth_${Date.now()}`,
      number: booth.number || `Estande ${booths.length + 1}`,
      exhibitor: booth.exhibitor || 'Vago',
      sector: booth.sector || 'Geral',
      price: Number(booth.price) || 1000,
      paidAmount: Number(booth.paidAmount) || 0,
      status: booth.status || 'pending',
      contact: booth.contact || '',
      notes: booth.notes || ''
    };
    booths.push(newB);
    this.saveBooths(booths);
    return newB;
  },

  deleteBooth(id) {
    const booths = this.getBooths();
    const filtered = booths.filter(b => b.id !== id);
    this.saveBooths(filtered);
    return filtered.length < booths.length;
  },

  // Configurações
  getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) {
        this.saveSettings(DEFAULT_SETTINGS);
        return { ...DEFAULT_SETTINGS };
      }
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (e) {
      console.error('Erro ao salvar configurações:', e);
      return false;
    }
  },

  getCategories() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (!raw) {
        this.saveCategories(DEFAULT_CATEGORIES);
        return { ...DEFAULT_CATEGORIES };
      }
      return JSON.parse(raw);
    } catch (e) {
      return { ...DEFAULT_CATEGORIES };
    }
  },

  saveCategories(categories) {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
      return true;
    } catch (e) {
      console.error('Erro ao salvar categorias:', e);
      return false;
    }
  },

  resetToDemoData() {
    const demoTxs = generateDemoTransactions();
    const demoBooths = generateDemoBooths();
    this.saveTransactions(demoTxs);
    this.saveBooths(demoBooths);
    this.saveCategories(DEFAULT_CATEGORIES);
    const currentSettings = this.getSettings();
    if (!currentSettings.fairName) {
      this.saveSettings({ ...DEFAULT_SETTINGS });
    }
    return demoTxs;
  },

  clearAllData() {
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.BOOTHS);
    return true;
  },

  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || null;
  },

  saveTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }
};
