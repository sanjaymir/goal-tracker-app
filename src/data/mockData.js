export const INITIAL_USERS = [
    {
        id: 'admin',
        name: 'Administrador',
        email: 'admin@empresa.com',
        password: 'admin',
        role: 'ADMIN',
        avatar: 'https://ui-avatars.com/api/?name=Admin&background=0ea5e9&color=fff'
    },
    {
        id: 'user1',
        name: 'João Silva',
        email: 'joao@empresa.com',
        password: '123',
        role: 'USER',
        avatar: 'https://ui-avatars.com/api/?name=Joao+Silva&background=random'
    },
    {
        id: 'user2',
        name: 'Maria Santos',
        email: 'maria@empresa.com',
        password: '123',
        role: 'USER',
        avatar: 'https://ui-avatars.com/api/?name=Maria+Santos&background=random'
    }
];

export const INITIAL_GOALS = [
    {
        id: 'g1',
        userId: 'user1',
        title: 'Vídeos para Social Media',
        description: 'Produzir e publicar vídeos no Instagram/TikTok',
        target: 2,
        current: 3,
        frequency: 'WEEKLY', // WEEKLY, MONTHLY
        unit: 'vídeos',
        deadline: '2025-12-31'
    },
    {
        id: 'g2',
        userId: 'user1',
        title: 'Leads Qualificados',
        description: 'Gerar novos leads através de campanhas',
        target: 50,
        current: 32,
        frequency: 'MONTHLY',
        unit: 'leads',
        deadline: '2025-12-31'
    },
    {
        id: 'g3',
        userId: 'user2',
        title: 'Artigos no Blog',
        description: 'Escrever artigos técnicos',
        target: 4,
        current: 1,
        frequency: 'MONTHLY',
        unit: 'artigos',
        deadline: '2025-12-31'
    }
];
