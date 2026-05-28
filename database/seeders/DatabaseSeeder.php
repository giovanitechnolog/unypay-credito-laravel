<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 🚀 Execução sequencial e limpa de toda a carga do sistema
        $this->call([
            // 1. Cadastra o usuário administrador do sistema
            AdminUserSeeder::class,

            // 2. Cria as categorias base (Mútuo, Consignado...)
            ContractTypeSeeder::class, 

            // 3. Injeta as cargas de Auditoria Purificada dos PDFs (14 Contratos Legítimos)
            LoadExternalContractsSeeder::class, 

            // 4. Injeta as baixas financeiras históricas, datas e valores reais da Planilha
            PopuleEcosistemaPlanilhaSeeder::class, 
        ]);
    }
}